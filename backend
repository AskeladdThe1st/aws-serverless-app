# lambda_function.py
"""
CalculusGPT — concise, verified, MathGPT-style tutor (OpenAI + SymPy + DynamoDB)
"""
import json, boto3, asyncio, sys, io, os, re as regex, time, traceback
from decimal import Decimal
from sympy import *
from openai import AsyncOpenAI
from graph_engine import (
    extract_graph_features,
    analyze_graph_features,
    generate_graph_explanation,
    analyze_graph_from_features,
    smart_graph_flow,
    is_graph_image,
    ensure_json_ready,
)

SYSTEM_PROMPT = (
    "You are CalculusGPT, a concise and accurate calculus tutor. "
    "Write clear, structured solutions in clear Markdown — no HTML. "
    "Use short, numbered steps like a textbook solution (1–4 steps max). "
    "Use display LaTeX math blocks (\\[ ... \\]) for equations. "
    "End with a boxed final answer (\\boxed{}). "
    "Include one fenced ```python``` block verifying the result using SymPy. "
    "Before computing any derivative or second derivative, ALWAYS simplify the algebraic expression fully if possible. "
    "For rational expressions, simplify the numerator and denominator first, combine like terms, expand or factor if needed, "
    "and reduce the entire expression before applying quotient rule, product rule, or chain rule. "
    "Only differentiate the simplified version. The final derivatives MUST be simplified. "
    "The SymPy verification must match the simplified derivative."
)

REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

# ----------------- AWS Clients -----------------
dynamo = boto3.resource("dynamodb", region_name=REGION)
sessions_table = dynamo.Table("calculus_sessions")


# ============================================================
#                DECIMAL CLEANER
# ============================================================

def clean_decimals(obj):
    if isinstance(obj, list):
        return [clean_decimals(i) for i in obj]
    if isinstance(obj, dict):
        return {k: clean_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


# ----------------- OpenAI setup -----------------

def _get_client() -> AsyncOpenAI:
    secret = boto3.client("secretsmanager", region_name=REGION).get_secret_value(
        SecretId="calculus-agent/openai-key"
    )
    return AsyncOpenAI(api_key=secret["SecretString"])


async def safe_openai_json(messages, model, max_tokens=None, temperature=0):
    try:
        client = _get_client()
        raw = await client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        text = (raw.choices[0].message.content or "").strip()
        return {"ok": True, "text": text}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _chat(messages, max_tokens=1400):
    res = await safe_openai_json(messages, "gpt-4o-mini", max_tokens=max_tokens, temperature=0)
    if not res["ok"]:
        return {"error": res["error"]}
    return {"text": res["text"]}


# ----------------- SymPy Execution helpers -----------------

def _exec(code: str) -> str:
    old, buf = sys.stdout, io.StringIO()
    try:
        sys.stdout = buf
        exec(code, {"sympy": sys.modules["sympy"]})
        return buf.getvalue().strip()
    finally:
        sys.stdout = old


def _verify_expression(code: str) -> bool:
    try:
        _ = _exec(code)
        return True
    except Exception:
        return False


# ============================================================
#                DYNAMODB CRUD HELPERS
# ============================================================

def respond(status: int, body: dict):
    return {"statusCode": status, "body": json.dumps(body)}

def create_session(user_id, session_id, title="New Chat", manual_mode=False):
    item = {
        "user_id": user_id,
        "session_id": session_id,
        "title": title,
        "manual_mode": bool(manual_mode),
        "messages": [],
        "createdAt": int(time.time()),
        "updatedAt": int(time.time()),
    }
    sessions_table.put_item(Item=item)
    return item


def get_session(user_id, session_id):
    resp = sessions_table.get_item(Key={"user_id": user_id, "session_id": session_id})
    return resp.get("Item")


def list_sessions(user_id):
    from boto3.dynamodb.conditions import Key

    resp = sessions_table.query(
        KeyConditionExpression=Key("user_id").eq(user_id)
    )
    return resp.get("Items", [])


def append_message(user_id, session_id, role, content):
    now = int(time.time())
    sessions_table.update_item(
        Key={"user_id": user_id, "session_id": session_id},
        UpdateExpression="SET messages = list_append(messages, :msg), updatedAt = :t",
        ExpressionAttributeValues={
            ":msg": [{"role": role, "content": content, "ts": now}],
            ":t": now,
        },
    )


def delete_session(user_id, session_id):
    sessions_table.delete_item(Key={"user_id": user_id, "session_id": session_id})


def update_title(user_id, session_id, title):
    now = int(time.time())
    sessions_table.update_item(
        Key={"user_id": user_id, "session_id": session_id},
        UpdateExpression="SET title = :title, updatedAt = :t",
        ExpressionAttributeValues={":title": title, ":t": now},
    )
    return {"updated": True}


def update_manual_mode(user_id, session_id, manual_mode):
    now = int(time.time())
    sessions_table.update_item(
        Key={"user_id": user_id, "session_id": session_id},
        UpdateExpression="SET manual_mode = :mm, updatedAt = :t",
        ExpressionAttributeValues={":mm": bool(manual_mode), ":t": now},
    )

def update_session(user_id, session_id, fields: dict):
    now = int(time.time())
    set_parts = []
    eav = {":t": now}
    for k, v in fields.items():
        set_parts.append(f"{k} = :{k}")
        eav[f":{k}"] = v
    set_parts.append("updatedAt = :t")
    update_expr = "SET " + ", ".join(set_parts)
    sessions_table.update_item(
        Key={"user_id": user_id, "session_id": session_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=eav,
    )
    return {"updated": True}

# ============================================================
#                GRAPH RESPONSE NORMALIZER
# ============================================================

def normalize_graph_payload(data: dict) -> dict:
    base = {
        "analysis_complete": False,
        "needs_clarification": False,
        "question": None,
        "analysis": None,
        "json": {},
        "image_preview": "",
        "step_number": 1,
    }
    base.update({k: v for k, v in (data or {}).items() if k in base})
    return ensure_json_ready(base)


# ============================================================
#                MAIN LAMBDA HANDLER
# ============================================================

def lambda_handler(event, context):
    try:
        # CORS preflight
        if (
            event.get("requestContext", {})
                .get("http", {})
                .get("method", "")
                .upper()
            == "OPTIONS"
            or (event.get("httpMethod") or "").upper() == "OPTIONS"
        ):
            return {"statusCode": 200, "body": json.dumps({"ok": True})}

        # Body parsing
        if "body" in event:
            raw = event.get("body") or "{}"
            if isinstance(raw, str):
                body = json.loads(raw)
            else:
                body = raw
        else:
            body = event

        action = body.get("action", "solve")
        text = str(body.get("text") or "").strip()

        # Always treat images as a list
        image_single = body.get("image")
        image_multi = body.get("images") or []
        image_list = []
        if image_single:
            image_list.append(image_single)
        if isinstance(image_multi, list):
            image_list.extend(image_multi)

        # Model selection
        requested_model = body.get("model") or "gpt-4o-mini"
        allowed_models = {"gpt-4o-mini", "gpt-4o", "gpt-5.1", "gpt-5.1-thinking"}
        model_choice = requested_model if requested_model in allowed_models else "gpt-4o-mini"

        user_id = body.get("user_id") or "guest"
        session_id = body.get("session_id")
        manual_mode_input = body.get("manual_mode")

        # classification endpoint
        if action == "classify":
            if not image_list:
                return {"statusCode": 400, "body": json.dumps({"error": "Image required for classification"})}
            is_graph = asyncio.run(is_graph_image(image_list[0], model_choice))
            return {"statusCode": 200, "body": json.dumps({"classification": "graph" if is_graph else "not_graph"})}

        # CRUD
        if action == "create":
            item = create_session(
                user_id,
                session_id,
                body.get("title") or "New Chat",
                manual_mode=manual_mode_input or False,
            )
            return {"statusCode": 200, "body": json.dumps(clean_decimals(item))}
        if action == "load":
            item = get_session(user_id, session_id)
            return {"statusCode": 200, "body": json.dumps(clean_decimals(item or {}))}
        if action == "list":
            items = list_sessions(user_id)
            return {"statusCode": 200, "body": json.dumps(clean_decimals(items))}
        if action == "delete":
            delete_session(user_id, session_id)
            return {"statusCode": 200, "body": json.dumps({"deleted": True})}
        if action == "update":
            if not user_id or not session_id:
                return respond(400, {"error": "Missing user_id or session_id"})
            update_fields = {}
            if "title" in body and body["title"] is not None:
                update_fields["title"] = body["title"]
            if "manual_mode" in body:
                update_fields["manual_mode"] = bool(body["manual_mode"])
            if not update_fields:
                return respond(400, {"error": "Nothing to update"})
            update_session(user_id, session_id, update_fields)
            return respond(200, {"message": "Session updated", "updated": update_fields})
        if action == "manual_graph":
            features = body.get("graph_features") or {}
            result = analyze_graph_from_features(features)
            if user_id and session_id and get_session(user_id, session_id):
                append_message(user_id, session_id, "user", "[Manual graph features submitted]")
                append_message(user_id, session_id, "assistant", result.get("analysis", ""))
            return {"statusCode": 200, "body": json.dumps(clean_decimals(result))}
        if manual_mode_input is not None and user_id and session_id and get_session(user_id, session_id):
            update_manual_mode(user_id, session_id, manual_mode_input)

        # GRAPH
        if action == "graph":
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return {"statusCode": 400, "body": json.dumps({"error": "Image required for graph analysis"})}

            # derivative text redirect
            if text.lower().strip() and any(term in text.lower() for term in [
                "derivative", "first derivative", "second derivative",
                "d/d", "dy/dx", "dp/dq", "find the derivative",
                "differentiate", "rate of change"
            ]):
                return lambda_handler({
                    "action": "solve",
                    "text": text,
                    "images": image_list,
                    "user_id": user_id,
                    "session_id": session_id
                }, context)

            session = get_session(user_id, session_id) if (user_id and session_id) else None
            manual_mode = bool(session.get("manual_mode")) if session else False
            history = []  # do not reuse old chat messages for manual graph flow

            result = asyncio.run(smart_graph_flow(graph_image, history, manual_mode, model_choice))
            payload = normalize_graph_payload(result)
            if session:
                append_message(user_id, session_id, "user", "[Image Uploaded]")
                if payload.get("needs_clarification"):
                    append_message(user_id, session_id, "assistant", payload.get("question", ""))
                elif payload.get("analysis_complete"):
                    append_message(user_id, session_id, "assistant", payload.get("analysis", ""))
            return {"statusCode": 200, "body": json.dumps(clean_decimals(payload))}

        # CLARIFY GRAPH
        if action == "clarify_graph":
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return {"statusCode": 400, "body": json.dumps({"error": "Image required for graph clarification"})}
            session = get_session(user_id, session_id) if (user_id and session_id) else None
            history = session.get("messages", []) if session else []
            if text:
                history = history + [{"role": "user", "content": text}]
            result = asyncio.run(smart_graph_flow(graph_image, history, True, model_choice))
            payload = normalize_graph_payload(result)
            if session:
                if text:
                    append_message(user_id, session_id, "user", text)
                if payload.get("needs_clarification"):
                    append_message(user_id, session_id, "assistant", payload.get("question", ""))
                elif payload.get("analysis_complete"):
                    append_message(user_id, session_id, "assistant", payload.get("analysis", ""))
            return {"statusCode": 200, "body": json.dumps(clean_decimals(payload))}

        # SOLVE (unchanged structure, now multi-image)
        if action == "solve":
            if not text and not image_list:
                return {"statusCode": 400, "body": json.dumps({"error": "No input provided."})}
            if not text and image_list:
                text = "Extract all problems from this image and solve them."
            session = get_session(user_id, session_id) if (user_id and session_id) else None
            history = session.get("messages", []) if session else []
            messages = [{"role": "system", "content": SYSTEM_PROMPT}]
            for msg in history:
                if not isinstance(msg, dict):
                    continue
                role = msg.get("role"); content = msg.get("content")
                if not role or content is None:
                    continue
                messages.append({"role": role, "content": str(content)})
            user_content = []
            if text:
                user_content.append({"type": "text", "text": text})
            for img_b64 in image_list:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                })
            if not user_content:
                return {"statusCode": 400, "body": json.dumps({"error": "No input provided."})}
            messages.append({"role": "user", "content": user_content})
            chat_res = asyncio.run(_chat(messages, 1400))
            if "error" in chat_res:
                return {"statusCode": 500, "body": json.dumps({"error": "OpenAIError", "details": chat_res["error"]})}
            reply = chat_res["text"]
            code = ""
            code_match = regex.search(r"```(?:python)?(.*?)```", reply, flags=regex.S)
            code = code_match.group(1).strip() if code_match else ""
            if code and not _verify_expression(code):
                fix_res = asyncio.run(_chat([{"role": "system", "content": "Fix this SymPy code to match the solution."}, {"role": "user", "content": code}], 300))
                if "error" in fix_res:
                    return {"statusCode": 500, "body": json.dumps({"error": "OpenAIError", "details": fix_res["error"]})}
                fixed = regex.search(r"```(?:python)?(.*?)```", fix_res["text"], flags=regex.S)
                if fixed:
                    code = fixed.group(1).strip()
            result = _exec(code) if code else ""
            if user_id and session_id and session:
                append_message(user_id, session_id, "user", text)
                append_message(user_id, session_id, "assistant", reply)
            return {
                "statusCode": 200,
                "body": json.dumps(clean_decimals({"expression": code or "", "result": result or "", "steps": reply or ""})),
            }

        return {"statusCode": 400, "body": json.dumps({"error": f"Unknown action: {action}"})}

    except Exception:
        traceback.print_exc()
        return {"statusCode": 500, "body": json.dumps({"error": "Internal server error"})}
