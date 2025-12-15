# graph_engine.py
"""
Redundant Multi-Pass Graph Feature Extraction Engine for CalculusGPT
(Secrets Manager Version)
"""
from __future__ import annotations

import json
import math
import os
import asyncio
from typing import Any, Dict, List, Optional, Tuple

import boto3
from openai import AsyncOpenAI

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

# ============================================================
# JSON sanitizer
# ============================================================

def ensure_json_ready(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (bool, int, float, str)):
        return obj
    if isinstance(obj, list):
        return [ensure_json_ready(i) for i in obj]
    if isinstance(obj, dict):
        return {str(k): ensure_json_ready(v) for k, v in obj.items()}
    try:
        json.dumps(obj)
        return obj
    except Exception:
        return str(obj)

# ============================================================
# OpenAI helpers
# ============================================================

def _get_client() -> AsyncOpenAI:
    sec = boto3.client("secretsmanager", region_name=REGION).get_secret_value(
        SecretId="calculus-agent/openai-key"
    )
    return AsyncOpenAI(api_key=sec["SecretString"])


async def _safe_chat(messages, model, max_tokens=None, temperature=0):
    try:
        client = _get_client()
        resp = await client.chat.completions.create(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=messages,
        )
        return {"ok": True, "text": (resp.choices[0].message.content or "").strip()}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ============================================================
# Feature keys
# ============================================================

FEATURE_KEYS = [
    "open_points",
    "filled_points",
    "corners",
    "jumps",
    "holes",
    "discontinuities",
    "endpoints",
    "smooth_intervals",
    "increasing_intervals",
    "decreasing_intervals",
    "concavity_changes",
]

POINT_KEYS = [
    "open_points",
    "filled_points",
    "corners",
    "jumps",
    "holes",
    "endpoints",
]

INTERVAL_KEYS = [
    "smooth_intervals",
    "increasing_intervals",
    "decreasing_intervals",
]

SPECIAL_POINT_KEYS = [
    "discontinuities",
    "concavity_changes",
]


def empty_features() -> Dict[str, Any]:
    return {key: [] for key in FEATURE_KEYS}


def ensure_feature_keys(data: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, List[Any]] = {}
    for key in FEATURE_KEYS:
        val = data.get(key, [])
        if val is None:
            val = []
        if not isinstance(val, list):
            val = [val]
        out[key] = val
    return out


def _safe_float(x: Any) -> Optional[float]:
    try:
        if isinstance(x, (int, float)):
            return float(x)
        if isinstance(x, str):
            x = x.strip()
            if x == "" or x.lower() == "nan":
                return None
            return float(x)
    except Exception:
        return None
    return None


def _canonical_point(obj: Any, decimals: int = 4) -> Optional[Tuple[float, float]]:
    x_val = y_val = None
    if isinstance(obj, (list, tuple)) and len(obj) >= 2:
        x_val, y_val = obj[0], obj[1]
    elif isinstance(obj, dict):
        if "x" in obj and "y" in obj:
            x_val, y_val = obj["x"], obj["y"]
        elif (
            "point" in obj
            and isinstance(obj["point"], (list, tuple))
            and len(obj["point"]) >= 2
        ):
            x_val, y_val = obj["point"][0], obj["point"][1]
    x_f = _safe_float(x_val)
    y_f = _safe_float(y_val)
    if x_f is None or y_f is None:
        return None
    return (round(x_f, decimals), round(y_f, decimals))


def _canonical_interval(obj: Any, decimals: int = 4) -> Optional[Tuple[float, float]]:
    start = end = None
    if isinstance(obj, (list, tuple)) and len(obj) >= 2:
        start, end = obj[0], obj[1]
    elif isinstance(obj, dict):
        start, end = obj.get("start"), obj.get("end")
    s_f = _safe_float(start)
    e_f = _safe_float(end)
    if s_f is None or e_f is None:
        return None
    if e_f < s_f:
        s_f, e_f = e_f, s_f
    return (round(s_f, decimals), round(e_f, decimals))


def _deepcopy_json(obj: Any) -> Any:
    return json.loads(json.dumps(obj))

# ============================================================
# Prompts
# ============================================================

PASS_DESCRIPTIONS = {
    1: "Pass A – focus on open vs filled circles and endpoints.",
    2: "Pass B – focus on all discontinuities (holes, jumps, infinite, removable).",
    3: "Pass C – focus on corners and nondifferentiable points.",
    4: "Pass D – segment-by-segment tracing, smooth vs non-smooth.",
    5: "Pass E – increasing/decreasing intervals.",
    6: "Pass F – concavity and inflection points.",
}


def _build_system_prompt(version: int) -> str:
    schema = (
        "You are an expert calculus tutor analyzing a 2D graph of y=f(x). "
        "Respond with STRICT JSON ONLY using this schema:\n"
        "{\n"
        '  "open_points": [ {"x": number, "y": number}, ... ],\n'
        '  "filled_points": [ {"x": number, "y": number}, ... ],\n'
        '  "corners": [ {"x": number, "y": number}, ... ],\n'
        '  "jumps": [ {"x": number, "y": number}, ... ],\n'
        '  "holes": [ {"x": number, "y": number}, ... ],\n'
        '  "discontinuities": [ { "x": number, "y": number | null, "type": "jump" | "removable" | "infinite" | "corner" | "endpoint", "side": "left" | "right" | "both" | "none"}],\n'
        '  "endpoints": [ {"x": number, "y": number}, ... ],\n'
        '  "smooth_intervals": [ {"start": number, "end": number}, ... ],\n'
        '  "increasing_intervals": [ {"start": number, "end": number}, ... ],\n'
        '  "decreasing_intervals": [ {"start": number, "end": number}, ... ],\n'
        '  "concavity_changes": [ {"x": number, "direction_before": "up"|"down"|"unknown", "direction_after": "up"|"down"|"unknown"} ]\n'
        "}\n"
        "If unsure, use null or empty lists. No explanations, no text outside JSON."
    )
    return schema + "\n\nFocus of this pass:\n" + PASS_DESCRIPTIONS.get(version, "General pass.")

# ============================================================
# GPT Pass
# ============================================================

async def gpt_extract_pass(image_b64: str, version: int, model: str) -> Dict[str, Any]:
    system_prompt = _build_system_prompt(version)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Analyze this graph carefully and fill the JSON. Pay close attention to open/filled circles, tiny gaps, jumps, corners, and concavity changes."},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
            ],
        },
    ]
    res = await _safe_chat(messages, model, max_tokens=900, temperature=0)
    if not res["ok"]:
        out = empty_features()
        out["error"] = res["error"]
        return ensure_json_ready(out)
    raw = res["text"]
    try:
        parsed = json.loads(raw)
    except Exception:
        try:
            start = raw.index("{"); end = raw.rindex("}") + 1
            parsed = json.loads(raw[start:end])
        except Exception:
            out = empty_features()
            out["error"] = "JSON parse error"
            out["raw_output"] = raw
            return ensure_json_ready(out)
    return ensure_json_ready(ensure_feature_keys(parsed))

# ============================================================
# Merge / Resolve
# ============================================================

def _canonical_item_for_key(key: str, item: Any) -> Optional[Tuple]:
    if key in POINT_KEYS:
        p = _canonical_point(item)
        if p: return ("pt", key, p[0], p[1])
    if key in INTERVAL_KEYS:
        iv = _canonical_interval(item)
        if iv: return ("int", key, iv[0], iv[1])
    if key in SPECIAL_POINT_KEYS and isinstance(item, dict):
        x = _safe_float(item.get("x"))
        if x is None: return None
        x = round(x, 4)
        t = str(item.get("type", "")).lower()
        s = str(item.get("side", "")).lower()
        return ("special", key, x, t, s)
    return None

def _merge_list_for_key(key: str, acc: List[Any], new: List[Any]) -> List[Any]:
    merged = list(acc)
    seen = set()
    for item in merged:
        c = _canonical_item_for_key(key, item)
        if c: seen.add(c)
    for item in new:
        c = _canonical_item_for_key(key, item)
        if c:
            if c not in seen:
                seen.add(c); merged.append(item)
        else:
            js = json.dumps(item, sort_keys=True)
            sig = ("json", js)
            if sig not in seen:
                seen.add(sig); merged.append(item)
    return merged

def merge_graph_passes(passes: List[Dict[str, Any]]) -> Dict[str, Any]:
    merged = empty_features()
    for p in passes:
        norm = ensure_feature_keys(p or {})
        for key in FEATURE_KEYS:
            merged[key] = _merge_list_for_key(key, merged[key], norm[key])
    return merged


def resolve_contradictions(features: Dict[str, Any]) -> Dict[str, Any]:
    feats = ensure_feature_keys(features)
    feats = _deepcopy_json(feats)
    disc_x: Dict[float, List[Dict[str, Any]]] = {}
    for d in feats["discontinuities"]:
        if isinstance(d, dict):
            x = _safe_float(d.get("x"))
            if x is not None:
                x = round(x, 4)
                disc_x.setdefault(x, []).append(d)
    hole_pts = {p for p in (_canonical_point(h) for h in feats["holes"]) if p}
    open_set = {p for p in (_canonical_point(o) for o in feats["open_points"]) if p}
    filled_set = {p for p in (_canonical_point(f) for f in feats["filled_points"]) if p}
    conflicts = open_set & filled_set
    for pt in conflicts:
        x, y = pt
        has_disc = x in disc_x
        is_hole = pt in hole_pts
        if has_disc or is_hole:
            filled_set.discard(pt)
    def rebuild(pts):
        return [{"x": x, "y": y} for x, y in pts]
    feats["open_points"] = rebuild(open_set)
    feats["filled_points"] = rebuild(filled_set)
    for x_key, items in disc_x.items():
        for d in items:
            if str(d.get("type", "")).lower() == "removable":
                xv = _safe_float(d.get("x")); yv = _safe_float(d.get("y"))
                if xv is not None and yv is not None:
                    pt = (round(xv, 4), round(yv, 4))
                    open_set.add(pt); filled_set.discard(pt)
    feats["open_points"] = rebuild(open_set)
    feats["filled_points"] = rebuild(filled_set)
    endpoint_pts = {p for p in (_canonical_point(e) for e in feats["endpoints"]) if p}
    filtered = []
    for d in feats["discontinuities"]:
        p = _canonical_point(d)
        if p and p in endpoint_pts:
            continue
        filtered.append(d)
    feats["discontinuities"] = filtered
    return feats

# ============================================================
# Orchestration
# ============================================================

async def extract_graph_features(image_b64: str, model: str) -> Dict[str, Any]:
    versions = [1, 2, 3, 4, 5, 6]
    raw_passes: List[Dict[str, Any]] = []
    for v in versions:
        feats = await gpt_extract_pass(image_b64, v, model)
        raw_passes.append({"version": v, "features": _deepcopy_json(feats)})
    merged = merge_graph_passes([p["features"] for p in raw_passes])
    resolved = resolve_contradictions(merged)
    resolved["raw_passes"] = raw_passes
    return ensure_json_ready(resolved)

# ============================================================
# Reasoning
# ============================================================

def analyze_graph_features(features: Dict[str, Any]) -> Dict[str, Any]:
    feats = ensure_feature_keys(features or {})
    feats = _deepcopy_json(feats)
    holes = [_canonical_point(h) for h in feats["holes"]]; holes = [p for p in holes if p]
    jumps = [_canonical_point(j) for j in feats["jumps"]]; jumps = [p for p in jumps if p]
    corners = [_canonical_point(c) for c in feats["corners"]]; corners = [p for p in corners if p]
    endpoints = [_canonical_point(e) for e in feats["endpoints"]]; endpoints = [p for p in endpoints if p]
    discontinuity_types: Dict[str, str] = {}
    discontinuous_points: List[Dict[str, Any]] = []
    nondiff_points_map: Dict[Tuple[float, float], str] = {}
    def _point_key(pt: Tuple[float, float]) -> str:
        return f"{pt[0]},{pt[1]}"
    def _add_discontinuous_point(pt: Optional[Tuple[float, float]], dtype: str, include_in_list: bool = True):
        if pt is None: return
        key = _point_key(pt)
        discontinuity_types.setdefault(key, dtype)
        if include_in_list:
            if not any(abs(p["x"] - pt[0]) < 1e-9 and abs(p["y"] - pt[1]) < 1e-9 for p in discontinuous_points):
                discontinuous_points.append({"x": pt[0], "y": pt[1]})
    def _mark_nondifferentiable(pt: Optional[Tuple[float, float]], reason: str):
        if pt is None: return
        nondiff_points_map[pt] = reason
    for pt in holes:
        _add_discontinuous_point(pt, "removable"); _mark_nondifferentiable(pt, "hole")
    for pt in jumps:
        _add_discontinuous_point(pt, "jump"); _mark_nondifferentiable(pt, "jump")
    for pt in corners:
        _mark_nondifferentiable(pt, "corner")
    for pt in endpoints:
        key = _point_key(pt)
        discontinuity_types.setdefault(key, "endpoint (continuous but not differentiable)")
        _mark_nondifferentiable(pt, "endpoint")
    for d in feats["discontinuities"]:
        if not isinstance(d, dict): continue
        disc_type = str(d.get("type", "")).lower()
        pt = _canonical_point(d); x = _safe_float(d.get("x")); y = _safe_float(d.get("y"))
        if disc_type == "jump":
            _add_discontinuous_point(pt, "jump"); _mark_nondifferentiable(pt, "jump")
        elif disc_type == "removable":
            _add_discontinuous_point(pt, "removable"); _mark_nondifferentiable(pt, "hole")
        elif disc_type == "infinite":
            if pt: _add_discontinuous_point(pt, "infinite")
            elif x is not None: discontinuity_types.setdefault(str(round(x, 4)), "undefined")
        elif disc_type == "endpoint":
            if pt:
                key = _point_key(pt)
                discontinuity_types.setdefault(key, "endpoint (continuous but not differentiable)")
                _mark_nondifferentiable(pt, "endpoint")
        if x is not None and (y is None or (isinstance(y, float) and math.isnan(y))):
            discontinuity_types.setdefault(str(round(x, 4)), "undefined")
    nondifferentiable_points = [
        {"x": pt[0], "y": pt[1], "reason": reason}
        for pt, reason in sorted(nondiff_points_map.items(), key=lambda kv: (kv[0][0], kv[0][1]))
    ]
    continuous_intervals = _deepcopy_json(feats["smooth_intervals"])
    differentiable_intervals = _deepcopy_json(feats["smooth_intervals"])
    increasing_intervals = _deepcopy_json(feats["increasing_intervals"])
    decreasing_intervals = _deepcopy_json(feats["decreasing_intervals"])
    concavity_up: List[Dict[str, Any]] = []
    concavity_down: List[Dict[str, Any]] = []
    inflection_points: List[Dict[str, Any]] = []
    seen_inflect_x = set()
    for c in feats["concavity_changes"]:
        if not isinstance(c, dict): continue
        x = _safe_float(c.get("x")); 
        if x is None: continue
        x = round(x, 4)
        if x in seen_inflect_x: continue
        seen_inflect_x.add(x); inflection_points.append({"x": x})
    seen_disc = set(); uniq_disc_points: List[Dict[str, Any]] = []
    for p in sorted(discontinuous_points, key=lambda t: (t["x"], t["y"])):
        key = (p["x"], p["y"])
        if key in seen_disc: continue
        seen_disc.add(key); uniq_disc_points.append(p)
    reasoning: Dict[str, Any] = {
        "continuous_intervals": continuous_intervals,
        "discontinuous_points": uniq_disc_points,
        "discontinuity_types": discontinuity_types,
        "differentiable_intervals": differentiable_intervals,
        "nondifferentiable_points": nondifferentiable_points,
        "increasing_intervals": increasing_intervals,
        "decreasing_intervals": decreasing_intervals,
        "concavity_up": concavity_up,
        "concavity_down": concavity_down,
        "inflection_points": inflection_points,
        "raw_features": _deepcopy_json(features),
    }
    return ensure_json_ready(reasoning)

# ============================================================
# Explanation
# ============================================================

async def generate_graph_explanation(reasoning: Dict[str, Any], model: str) -> str:
    system_prompt = (
        "You are an expert calculus tutor explaining properties of a graph y=f(x). "
        "You are given a JSON object called 'reasoning' that is the ground truth. "
        "Do not contradict it. If something is unknown, say so. "
        "Be concise, bullet points, LaTeX for math/intervals."
    )
    user_content = "JSON reasoning:\n```json\n" + json.dumps(reasoning, indent=2) + "\n```"
    res = await _safe_chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        model,
        max_tokens=600,
        temperature=0,
    )
    if not res["ok"]:
        return "Graph reasoning summary is unavailable due to an error while generating the explanation."
    return res["text"]

# ============================================================
# Manual feature analysis
# ============================================================

def analyze_graph_from_features(features: Dict[str, Any]) -> Dict[str, Any]:
    safe_features = features or {}
    system_prompt = (
        "Analyze a graph using ONLY provided structured features. Do NOT guess. "
        "Return JSON with 'analysis' and 'json'."
    )
    user_prompt = "Features:\n```json\n" + json.dumps(safe_features, indent=2) + "\n```"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        res = asyncio.run(_safe_chat(messages, "gpt-4.1", max_tokens=900, temperature=0))
        if not res["ok"]:
            raise Exception(res["error"])
        raw = res["text"]
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and "analysis" in parsed and "json" in parsed:
                return ensure_json_ready(parsed)
        except Exception:
            pass
        return ensure_json_ready({"analysis": raw, "json": safe_features})
    except Exception as e:
        return ensure_json_ready({"analysis": f"Analysis unavailable: {e}", "json": safe_features})

# ============================================================
# Graph image classifier
# ============================================================

async def is_graph_image(image_b64: str, model: str) -> bool:
    messages = [
        {
            "role": "system",
            "content": "You are a vision classifier. Answer ONLY yes or no.",
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Is this image a mathematical graph with axes or plotted curves? Answer ONLY yes or no.",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_b64}"},
                },
            ],
        },
    ]
    res = await _safe_chat(messages, model, max_tokens=5, temperature=0)
    if not res["ok"]:
        return False
    return res["text"].strip().lower().startswith("y")

# ============================================================
# Uncertainty + questions (hybrid)
# ============================================================

def detect_uncertain_features(auto_features: Dict[str, Any]) -> List[str]:
    f = ensure_feature_keys(auto_features or {})
    uncertain = []
    if len(f["endpoints"]) == 0:
        uncertain.append("endpoint_open_closed")
    if len(f["open_points"]) == 0 and len(f["filled_points"]) == 0:
        uncertain.append("hole_vs_filled")
    if len(f["discontinuities"]) == 0:
        uncertain.append("unclear_discontinuity")
    if len(f["increasing_intervals"]) == 0 and len(f["decreasing_intervals"]) == 0:
        uncertain.append("unclear_monotonicity")
    if len(f["concavity_changes"]) == 0:
        uncertain.append("concavity_boundaries")
    if len(f["smooth_intervals"]) == 0:
        uncertain.append("smoothness")
    return uncertain


def generate_clarifying_question(feature: str) -> str:
    mapping = {
        "endpoint_open_closed": "Is the left or right endpoint open (○) or closed (●)?",
        "hole_vs_filled": "At ambiguous points, is it a hole (○) or a filled point (●)?",
        "unclear_discontinuity": "Are there any discontinuities or jumps? If so, where?",
        "unclear_monotonicity": "On which intervals is the function increasing or decreasing?",
        "concavity_boundaries": "Where does concavity change? Any inflection points?",
        "smoothness": "Are there corners or non-smooth points? Where?",
    }
    return mapping.get(feature, "Could you clarify an uncertain feature of the graph?")


def merge_user_correction(auto_features: Dict[str, Any], user_text: str) -> Dict[str, Any]:
    # Simple heuristic: append user text to notes
    updated = _deepcopy_json(auto_features)
    notes = updated.get("notes") or []
    notes.append(user_text)
    updated["notes"] = notes
    return updated

# ============================================================
# Smart flow (auto + hybrid manual)
# ============================================================

def _count_assistant_questions(history: List[Dict[str, Any]]) -> int:
    count = 0
    for msg in history or []:
        if msg.get("role") == "assistant":
            content = str(msg.get("content") or "").strip()
            if content.endswith("?"):
                count += 1
    return count


async def smart_graph_flow(image_b64: str, history: List[Dict[str, Any]], manual_mode: bool, model: str) -> Dict[str, Any]:
    if manual_mode:
        # Hybrid manual: use auto extraction, but ask targeted clarifications
        auto_features = await extract_graph_features(image_b64, model)
        updated_features = auto_features
        last_user = next((m for m in reversed(history or []) if m.get("role") == "user"), None)
        if last_user:
            updated_features = merge_user_correction(auto_features, str(last_user.get("content") or ""))

        uncertain = detect_uncertain_features(updated_features)
        step_number = 1 + _count_assistant_questions(history)

        if uncertain:
            q = generate_clarifying_question(uncertain[0])
            return ensure_json_ready({
                "needs_clarification": True,
                "analysis_complete": False,
                "question": q,
                "analysis": None,
                "json": updated_features,
                "features": updated_features,
                "image_preview": image_b64,
                "step_number": step_number,
            })

        reasoning = analyze_graph_features(updated_features)
        analysis = await generate_graph_explanation(reasoning, model)
        return ensure_json_ready({
            "needs_clarification": False,
            "analysis_complete": True,
            "analysis": analysis,
            "question": None,
            "json": updated_features,
            "features": updated_features,
            "image_preview": image_b64,
            "step_number": step_number,
        })

    # Auto mode
    features = await extract_graph_features(image_b64, model)
    clarified = any(msg.get("role") == "user" and not str(msg.get("content", "")).startswith("[Image") for msg in history or [])
    step_number = 1 + _count_assistant_questions(history)

    if detect_uncertain_features(features) and not clarified:
        question = "Is the point at a visible open circle closed or open, and are there any intervals where the function is increasing?"
        return ensure_json_ready({
            "needs_clarification": True,
            "analysis_complete": False,
            "question": question,
            "analysis": None,
            "json": features,
            "features": features,
            "image_preview": image_b64,
            "step_number": step_number,
        })

    reasoning = analyze_graph_features(features)
    analysis = await generate_graph_explanation(reasoning, model)
    return ensure_json_ready({
        "needs_clarification": False,
        "analysis_complete": True,
        "analysis": analysis,
        "question": None,
        "json": features,
        "features": features,
        "image_preview": image_b64,
        "step_number": step_number,
    })
