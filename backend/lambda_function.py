# lambda_function.py
"""
CalculusGPT — concise, verified, MathGPT-style tutor (OpenAI + SymPy + DynamoDB)
"""
import json, boto3, asyncio, sys, io, os, re as regex, time, traceback, base64
from datetime import datetime
from decimal import Decimal
from sympy import *
from openai import AsyncOpenAI
import stripe
from botocore.exceptions import ClientError

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
USAGE_TABLE = os.environ.get("USAGE_TABLE", "calculus_usage")
SESSIONS_TABLE = os.environ.get("SESSIONS_TABLE", "calculus_sessions")
OPENAI_SECRET_NAME = os.environ.get("OPENAI_SECRET_NAME", "calculus-agent/openai-key")
STRIPE_SECRET_NAME = os.environ.get("STRIPE_SECRET_NAME", "calculus-agent/stripe-secret")
STRIPE_WEBHOOK_SECRET_NAME = os.environ.get("STRIPE_WEBHOOK_SECRET_NAME", "calculus-agent/stripe-webhook")
STRIPE_PRICE_STUDENT = os.environ.get("STRIPE_PRICE_STUDENT")
STRIPE_PRICE_PRO = os.environ.get("STRIPE_PRICE_PRO")
SUCCESS_URL = os.environ.get("STRIPE_SUCCESS_URL", "https://example.com/success")
CANCEL_URL = os.environ.get("STRIPE_CANCEL_URL", "https://example.com/cancel")
FREE_DAILY_LIMIT = int(os.environ.get("FREE_DAILY_LIMIT", "15"))
GUEST_DAILY_LIMIT = int(os.environ.get("GUEST_DAILY_LIMIT", "4"))
GIT_SHA = os.environ.get("GIT_SHA", "unknown")
BUILD_TIME = os.environ.get("BUILD_TIME", "unknown")
# CORS is handled by the Lambda Function URL configuration; no manual CORS headers are set here.

PRO_MODELS = {
    "gpt-5.1",
    "gpt-5.1-turbo",
    "gpt-5.1-flash",
    "gpt-5.1-thinking",
}
STUDENT_MODELS = {
    "gpt-4.1",
    "gpt-4.1-preview",
}
FREE_MODELS = {
    "gpt-4o-mini",
    "gpt-4o",
}
ALLOWED_MODELS = {*FREE_MODELS, *STUDENT_MODELS, *PRO_MODELS}

DEFAULT_USER_AVATAR_ID = "user-default"
DEFAULT_TUTOR_AVATAR_ID = "tutor-classic"

ALLOWED_MODES = ["homework", "practice", "exam"]

USER_AVATAR_OPTIONS = [
    {"id": DEFAULT_USER_AVATAR_ID, "label": "Default", "tier": "free"},
    {"id": "user-graph", "label": "Graph Explorer", "tier": "student"},
    {"id": "user-pro", "label": "Pro Analyst", "tier": "pro"},
]

TUTOR_AVATAR_OPTIONS = [
    {"id": DEFAULT_TUTOR_AVATAR_ID, "label": "Math Tutor", "tier": "free"},
    {"id": "tutor-clarity", "label": "Clarity Coach", "tier": "student"},
    {"id": "tutor-pro", "label": "Expert Mentor", "tier": "pro"},
]

# ----------------- AWS Clients -----------------
dynamo = boto3.resource("dynamodb", region_name=REGION)
sessions_table = dynamo.Table(SESSIONS_TABLE)
usage_table = dynamo.Table(USAGE_TABLE)
CONFIG_CHECK = None
CONFIG_CHECK_AT = 0
CONFIG_TTL_SECONDS = 300


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

def _get_openai_api_key() -> str:
    # Prefer environment variable to keep Lambda portable across accounts.
    env_key = os.environ.get("OPENAI_API_KEY")
    if env_key:
        return env_key

    # Fall back to Secrets Manager if configured.
    try:
        secret = boto3.client("secretsmanager", region_name=REGION).get_secret_value(
            SecretId=OPENAI_SECRET_NAME
        )
    except ClientError as e:
        raise RuntimeError(
            "OpenAI API key missing. Set OPENAI_API_KEY env var or create the "
            f"'{OPENAI_SECRET_NAME}' secret: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e

    raw = secret.get("SecretString") or ""
    try:
        parsed = json.loads(raw)
        key = parsed.get("api_key") or parsed.get("OPENAI_API_KEY") or parsed.get("key")
    except Exception:
        key = raw
    if not key:
        raise RuntimeError(
            "OpenAI API key is empty. Set OPENAI_API_KEY or populate the Secrets Manager value."
        )
    return str(key)


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=_get_openai_api_key())


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

def respond(status: int, body: dict, origin: str | None = None):
    """Return a JSON response with content-type headers."""
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
        },
        "body": json.dumps(body),
    }


def _today():
    return datetime.utcnow().strftime("%Y-%m-%d")


def _get_secret_value(secret_name: str):
    try:
        sec = boto3.client("secretsmanager", region_name=REGION).get_secret_value(
            SecretId=secret_name
        )
        raw = sec.get("SecretString") or ""
        try:
            parsed = json.loads(raw)
            return parsed
        except Exception:
            return raw
    except ClientError as e:
        raise RuntimeError(
            f"Unable to read secret '{secret_name}': {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def _get_stripe_api_key() -> str:
    env_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    if env_key:
        return env_key

    raw = _get_secret_value(STRIPE_SECRET_NAME)
    if isinstance(raw, dict):
        return raw.get("api_key") or raw.get("secret") or raw.get("STRIPE_SECRET_KEY") or ""
    return str(raw)


def _get_webhook_secret() -> str:
    env_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if env_secret:
        return env_secret

    raw = _get_secret_value(STRIPE_WEBHOOK_SECRET_NAME)
    if isinstance(raw, dict):
        return raw.get("secret") or raw.get("STRIPE_WEBHOOK_SECRET") or ""
    return str(raw)


def _config_status(force_refresh: bool = False):
    """Return configuration diagnostics to surface misconfiguration fast."""
    global CONFIG_CHECK, CONFIG_CHECK_AT

    now = time.time()
    if not force_refresh and CONFIG_CHECK and now - CONFIG_CHECK_AT < CONFIG_TTL_SECONDS:
        return CONFIG_CHECK

    errors, warnings = [], []
    # DynamoDB table presence
    try:
        boto3.client("dynamodb", region_name=REGION).describe_table(TableName=SESSIONS_TABLE)
    except ClientError as e:
        errors.append(
            f"Sessions table '{SESSIONS_TABLE}' not reachable: {e.response.get('Error', {}).get('Message', str(e))}"
        )
    try:
        boto3.client("dynamodb", region_name=REGION).describe_table(TableName=USAGE_TABLE)
    except ClientError as e:
        errors.append(
            f"Usage table '{USAGE_TABLE}' not reachable: {e.response.get('Error', {}).get('Message', str(e))}"
        )

    # Secrets / env vars
    if not os.environ.get("OPENAI_API_KEY"):
        try:
            _ = _get_openai_api_key()
        except Exception as e:
            errors.append(str(e))
    if not (os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")):
        try:
            _ = _get_stripe_api_key()
        except Exception as e:
            errors.append(f"Stripe secret missing: {e}")
    if not os.environ.get("STRIPE_WEBHOOK_SECRET"):
        try:
            _ = _get_webhook_secret()
        except Exception as e:
            warnings.append(f"Stripe webhook secret unavailable: {e}")

    CONFIG_CHECK = {"ok": len(errors) == 0, "errors": errors, "warnings": warnings}
    CONFIG_CHECK_AT = now
    return CONFIG_CHECK


def _normalize_plan(record: dict, user_role: str) -> str:
    plan = (record.get("plan") or "").lower()
    if plan not in {"guest", "free", "student", "pro"}:
        plan = "guest" if user_role == "guest" else "free"
        record["plan"] = plan
    return plan


def get_usage_record(user_id: str, user_role: str = "guest") -> dict:
    try:
        resp = usage_table.get_item(Key={"user_id": user_id})
        item = resp.get("Item") or {}
        today = _today()
        if not item:
            item = {
                "user_id": user_id,
                "plan": "guest" if user_role == "guest" else "free",
                "subscription_status": "inactive",
                "usage_date": today,
                "usage_count": 0,
                "user_avatar": None,
                "tutor_avatar": None,
                "workspaces": [],
                "mode": "homework",
            }
            usage_table.put_item(Item=item)
            return item
        _normalize_plan(item, user_role)
        changed = False
        if "user_avatar" not in item:
            item["user_avatar"] = None
            changed = True
        if "tutor_avatar" not in item:
            item["tutor_avatar"] = None
            changed = True
        if "workspaces" not in item:
            item["workspaces"] = []
            changed = True
        if "mode" not in item:
            item["mode"] = "homework"
            changed = True
        if item.get("mode") not in ALLOWED_MODES:
            item["mode"] = "homework"
            changed = True
        if item.get("usage_date") != today:
            item["usage_date"] = today
            item["usage_count"] = 0
            changed = True
        if changed:
            usage_table.put_item(Item=item)
        return item
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB get_usage_record failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def calculate_usage_info(user_id: str, user_role: str = "guest", record: dict | None = None) -> dict:
    record = record or get_usage_record(user_id, user_role)
    plan = _normalize_plan(record, user_role)
    status = (record.get("subscription_status") or "inactive").lower()
    is_paid = plan in {"student", "pro"} or status in {"active", "trialing", "past_due"}
    limit = None if is_paid else (FREE_DAILY_LIMIT if plan == "free" else GUEST_DAILY_LIMIT)
    used = int(record.get("usage_count") or 0)
    problems_left = None if limit is None else max(limit - used, 0)
    login_required = plan == "guest" and limit is not None and problems_left <= 0
    upgrade_required = plan == "free" and limit is not None and problems_left <= 0
    return {
        "plan": plan,
        "subscription_status": status,
        "limit": limit,
        "used_today": used,
        "problems_left": problems_left,
        "upgrade_required": False if limit is None else problems_left <= 0,
        "login_required": login_required,
        "is_paid": is_paid,
    }


def increment_usage(user_id: str, user_role: str = "guest") -> dict:
    try:
        record = get_usage_record(user_id, user_role)
        record["usage_date"] = _today()
        record["usage_count"] = int(record.get("usage_count") or 0) + 1
        usage_table.put_item(Item=record)
        return calculate_usage_info(user_id, user_role, record=record)
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB increment_usage failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def update_subscription(
    user_id: str,
    status: str,
    customer_id: str = None,
    subscription_id: str = None,
    plan_type: str | None = None,
):
    try:
        if plan_type:
            plan_type = str(plan_type).lower()
            if plan_type not in {"student", "pro", "free"}:
                plan_type = "pro"
        record = get_usage_record(user_id, "user")
        record["subscription_status"] = status
        if plan_type:
            record["plan"] = plan_type
        elif status not in {"active", "trialing", "past_due"}:
            record["plan"] = "free"
        elif record.get("plan") not in {"student", "pro"}:
            record["plan"] = "pro"
        if customer_id:
            record["stripe_customer_id"] = customer_id
        if subscription_id:
            record["subscription_id"] = subscription_id
        usage_table.put_item(Item=record)
        return record
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB update_subscription failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def _avatar_locked(tier: str, plan: str) -> bool:
    tier = (tier or "free").lower()
    plan = (plan or "guest").lower()
    if tier == "free":
        return False
    if tier == "student":
        return plan == "guest"
    if tier == "pro":
        return plan != "pro"
    return False


def build_avatar_state(record: dict, plan: str) -> dict:
    selected_user = record.get("user_avatar") or DEFAULT_USER_AVATAR_ID
    selected_tutor = record.get("tutor_avatar") or DEFAULT_TUTOR_AVATAR_ID

    user_options = [
        {**opt, "locked": _avatar_locked(opt.get("tier"), plan)} for opt in USER_AVATAR_OPTIONS
    ]
    tutor_options = [
        {**opt, "locked": _avatar_locked(opt.get("tier"), plan)} for opt in TUTOR_AVATAR_OPTIONS
    ]

    if selected_user not in {opt["id"] for opt in user_options}:
        selected_user = DEFAULT_USER_AVATAR_ID
    if selected_tutor not in {opt["id"] for opt in tutor_options}:
        selected_tutor = DEFAULT_TUTOR_AVATAR_ID

    return {
        "selected_user": selected_user,
        "selected_tutor": selected_tutor,
        "user_options": user_options,
        "tutor_options": tutor_options,
        "persona": selected_tutor,
    }


def build_workspace_state(record: dict) -> list:
    workspaces = record.get("workspaces") if isinstance(record, dict) else []
    return workspaces if isinstance(workspaces, list) else []

    if selected_user not in {opt["id"] for opt in user_options}:
        selected_user = DEFAULT_USER_AVATAR_ID
    if selected_tutor not in {opt["id"] for opt in tutor_options}:
        selected_tutor = DEFAULT_TUTOR_AVATAR_ID

    return {
        "selected_user": selected_user,
        "selected_tutor": selected_tutor,
        "user_options": user_options,
        "tutor_options": tutor_options,
        "persona": selected_tutor,
    }

def build_user_state(
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
) -> dict:
    record = record or get_usage_record(user_id, user_role)
    usage = usage_info or calculate_usage_info(user_id, user_role, record=record)
    plan = usage.get("plan") or _normalize_plan(record, user_role)
    avatars = build_avatar_state(record, plan)
    workspaces = build_workspace_state(record)
    mode = record.get("mode") or "homework"
    if mode not in ALLOWED_MODES:
        mode = "homework"

    return {
        "plan": plan,
        "usage": usage,
        "usageCount": usage.get("used_today"),
        "usageLimit": usage.get("limit"),
        "user_avatar": record.get("user_avatar"),
        "tutor_avatar": record.get("tutor_avatar"),
        "persona": avatars.get("selected_tutor"),
        "avatars": avatars,
        "workspaces": workspaces,
        "mode": mode,
        "modes": {"active": mode, "available": ALLOWED_MODES},
        "limits": {"guest_daily_limit": GUEST_DAILY_LIMIT, "free_daily_limit": FREE_DAILY_LIMIT},
        "subscription_status": record.get("subscription_status", "inactive"),
        "subscription_id": record.get("subscription_id"),
        "stripe_customer_id": record.get("stripe_customer_id"),
        "config": {"avatars_enabled": True, "workspace_enabled": True, "modes_enabled": True},
    }

def build_workspace_state(record: dict) -> list:
    workspaces = record.get("workspaces") if isinstance(record, dict) else []
    return workspaces if isinstance(workspaces, list) else []

    if requested_model in PRO_MODELS and plan != "pro":
        return respond(
            403,
            ensure_meta_fields(
                {
                    "error": "pro_model_locked",
                    "message": "Pro models require an active Pro subscription.",
                    "usage": info,
                    "upgrade_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )

def build_user_state(
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
) -> dict:
    record = record or get_usage_record(user_id, user_role)
    usage = usage_info or calculate_usage_info(user_id, user_role, record=record)
    plan = usage.get("plan") or _normalize_plan(record, user_role)
    avatars = build_avatar_state(record, plan)
    workspaces = build_workspace_state(record)
    mode = record.get("mode") or "homework"
    if mode not in ALLOWED_MODES:
        mode = "homework"

    return {
        "plan": plan,
        "usage": usage,
        "usageCount": usage.get("used_today"),
        "usageLimit": usage.get("limit"),
        "user_avatar": record.get("user_avatar"),
        "tutor_avatar": record.get("tutor_avatar"),
        "persona": avatars.get("selected_tutor"),
        "avatars": avatars,
        "workspaces": workspaces,
        "mode": mode,
        "modes": {"active": mode, "available": ALLOWED_MODES},
        "limits": {"guest_daily_limit": GUEST_DAILY_LIMIT, "free_daily_limit": FREE_DAILY_LIMIT},
        "subscription_status": record.get("subscription_status", "inactive"),
        "subscription_id": record.get("subscription_id"),
        "stripe_customer_id": record.get("stripe_customer_id"),
        "config": {"avatars_enabled": True, "workspace_enabled": True, "modes_enabled": True},
    }


def build_profile_payload(
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
) -> dict:
    record = record or get_usage_record(user_id, user_role)
    usage = usage_info or calculate_usage_info(user_id, user_role, record=record)
    plan = usage.get("plan") or _normalize_plan(record, user_role)
    state = build_user_state(user_id, user_role, usage_info=usage, record=record)

    return {
        "usage": usage,
        "plan": plan,
        "limits": {"guest_daily_limit": GUEST_DAILY_LIMIT, "free_daily_limit": FREE_DAILY_LIMIT},
        "avatars": state.get("avatars"),
        "workspaces": state.get("workspaces", []),
        "mode": state.get("mode"),
        "modes": state.get("modes"),
        "config": state.get("config", {}),
        "user_state": state,
    }


def ensure_meta_fields(
    body: dict,
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
):
    profile = build_profile_payload(user_id, user_role, usage_info=usage_info, record=record)
    if not isinstance(body, dict):
        return profile
    enriched = {**profile, **body}
    if "user_state" not in enriched:
        enriched["user_state"] = profile.get("user_state")
    if "usage" in body and usage_info:
        enriched["usage"] = usage_info
    return enriched


def check_model_entitlement(
    user_id: str, user_role: str, requested_model: str | None, usage_info: dict | None = None
):
    if not requested_model:
        return None
    if requested_model not in ALLOWED_MODELS:
        return respond(
            400,
            ensure_meta_fields(
                {"error": "unsupported_model", "message": "Model not available"},
                user_id,
                user_role,
                usage_info=usage_info,
            ),
        )
    info = usage_info or calculate_usage_info(user_id, user_role)
    plan = info.get("plan")

    if requested_model in PRO_MODELS and plan != "pro":
        return respond(
            403,
            ensure_meta_fields(
                {
                    "error": "pro_model_locked",
                    "message": "Pro models require an active Pro subscription.",
                    "usage": info,
                    "upgrade_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )

    if requested_model in STUDENT_MODELS and user_role == "guest":
        return respond(
            401,
            ensure_meta_fields(
                {
                    "error": "login_required",
                    "message": "Sign in to use advanced models.",
                    "usage": info,
                    "login_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )
    return None


def enforce_usage(user_id: str, user_role: str = "guest", requested_model: str | None = None):
    info = calculate_usage_info(user_id, user_role)
    entitlement_gate = check_model_entitlement(user_id, user_role, requested_model, info)
    if entitlement_gate:
        return entitlement_gate

def build_profile_payload(
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
) -> dict:
    record = record or get_usage_record(user_id, user_role)
    usage = usage_info or calculate_usage_info(user_id, user_role, record=record)
    plan = usage.get("plan") or _normalize_plan(record, user_role)
    state = build_user_state(user_id, user_role, usage_info=usage, record=record)

    return {
        "usage": usage,
        "plan": plan,
        "limits": {"guest_daily_limit": GUEST_DAILY_LIMIT, "free_daily_limit": FREE_DAILY_LIMIT},
        "avatars": state.get("avatars"),
        "workspaces": state.get("workspaces", []),
        "mode": state.get("mode"),
        "modes": state.get("modes"),
        "config": state.get("config", {}),
        "user_state": state,
    }


def ensure_meta_fields(
    body: dict,
    user_id: str,
    user_role: str,
    usage_info: dict | None = None,
    record: dict | None = None,
):
    profile = build_profile_payload(user_id, user_role, usage_info=usage_info, record=record)
    if not isinstance(body, dict):
        return profile
    enriched = {**profile, **body}
    if "user_state" not in enriched:
        enriched["user_state"] = profile.get("user_state")
    if "usage" in body and usage_info:
        enriched["usage"] = usage_info
    return enriched


def check_model_entitlement(
    user_id: str, user_role: str, requested_model: str | None, usage_info: dict | None = None
):
    if not requested_model:
        return None
    if requested_model not in ALLOWED_MODELS:
        return respond(
            400,
            ensure_meta_fields(
                {"error": "unsupported_model", "message": "Model not available"},
                user_id,
                user_role,
                usage_info=usage_info,
            ),
        )
    info = usage_info or calculate_usage_info(user_id, user_role)
    plan = info.get("plan")

    if requested_model in PRO_MODELS and plan != "pro":
        return respond(
            403,
            ensure_meta_fields(
                {
                    "error": "pro_model_locked",
                    "message": "Pro models require an active Pro subscription.",
                    "usage": info,
                    "upgrade_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )

    if requested_model in STUDENT_MODELS and user_role == "guest":
        return respond(
            401,
            ensure_meta_fields(
                {
                    "error": "login_required",
                    "message": "Sign in to use advanced models.",
                    "usage": info,
                    "login_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )
    return None


def enforce_usage(user_id: str, user_role: str = "guest", requested_model: str | None = None):
    info = calculate_usage_info(user_id, user_role)
    entitlement_gate = check_model_entitlement(user_id, user_role, requested_model, info)
    if entitlement_gate:
        return entitlement_gate

    if info["limit"] is not None and info.get("problems_left", 0) <= 0:
        if info.get("plan") == "guest":
            return respond(
                429,
                ensure_meta_fields(
                    {
                        "error": "guest_limit_reached",
                        "message": "Guests get 4 problems per day. Log in for more.",
                        "usage": info,
                        "login_required": True,
                    },
                    user_id,
                    user_role,
                    usage_info=info,
                ),
            )
        return respond(
            429,
            ensure_meta_fields(
                {
                    "error": "limit_reached",
                    "message": "Daily limit reached. Upgrade to continue.",
                    "usage": info,
                    "upgrade_required": True,
                },
                user_id,
                user_role,
                usage_info=info,
            ),
        )
    return info


def enforce_model_access(user_id: str, user_role: str, requested_model: str | None):
    return check_model_entitlement(user_id, user_role, requested_model)

def create_session(user_id, session_id, title="New Chat", manual_mode=False):
    try:
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
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB create_session failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def get_session(user_id, session_id):
    try:
        resp = sessions_table.get_item(Key={"user_id": user_id, "session_id": session_id})
        return resp.get("Item")
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB get_session failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def list_sessions(user_id):
    from boto3.dynamodb.conditions import Key

    try:
        resp = sessions_table.query(
            KeyConditionExpression=Key("user_id").eq(user_id)
        )
        return resp.get("Items", [])
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB list_sessions failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def append_message(user_id, session_id, role, content):
    now = int(time.time())
    try:
        sessions_table.update_item(
            Key={"user_id": user_id, "session_id": session_id},
            UpdateExpression="SET messages = list_append(messages, :msg), updatedAt = :t",
            ExpressionAttributeValues={
                ":msg": [{"role": role, "content": content, "ts": now}],
                ":t": now,
            },
        )
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB append_message failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def delete_session(user_id, session_id):
    try:
        sessions_table.delete_item(Key={"user_id": user_id, "session_id": session_id})
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB delete_session failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def update_title(user_id, session_id, title):
    now = int(time.time())
    try:
        sessions_table.update_item(
            Key={"user_id": user_id, "session_id": session_id},
            UpdateExpression="SET title = :title, updatedAt = :t",
            ExpressionAttributeValues={":title": title, ":t": now},
        )
        return {"updated": True}
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB update_title failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def update_manual_mode(user_id, session_id, manual_mode):
    now = int(time.time())
    try:
        sessions_table.update_item(
            Key={"user_id": user_id, "session_id": session_id},
            UpdateExpression="SET manual_mode = :mm, updatedAt = :t",
            ExpressionAttributeValues={":mm": bool(manual_mode), ":t": now},
        )
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB update_manual_mode failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e

def update_session(user_id, session_id, fields: dict):
    now = int(time.time())
    set_parts = []
    eav = {":t": now}
    for k, v in fields.items():
        set_parts.append(f"{k} = :{k}")
        eav[f":{k}"] = v
    set_parts.append("updatedAt = :t")
    update_expr = "SET " + ", ".join(set_parts)
    try:
        sessions_table.update_item(
            Key={"user_id": user_id, "session_id": session_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=eav,
        )
        return {"updated": True}
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB update_session failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e

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
        headers_raw = event.get("headers") or {}
        headers = {str(k).lower(): v for k, v in headers_raw.items()}
        global _REQUEST_ORIGIN
        _REQUEST_ORIGIN = headers.get("origin") or headers.get("referer") or headers.get("host")

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        config = _config_status()

        # Stripe webhook handling (raw payload)
        stripe_sig = headers.get("stripe-signature")
        if stripe_sig:
            payload = event.get("body") or ""
            if event.get("isBase64Encoded"):
                payload = base64.b64decode(payload)
            secret = _get_webhook_secret()
            try:
                stripe.api_key = _get_stripe_api_key()
                stripe_event = stripe.Webhook.construct_event(payload, stripe_sig, secret)
            except Exception as e:
                return respond(400, {"error": "WebhookError", "message": str(e)})

            evt_type = stripe_event.get("type")
            data_obj = stripe_event.get("data", {}).get("object", {}) or {}
            if evt_type == "checkout.session.completed":
                metadata = data_obj.get("metadata") or {}
                user_meta = dict(metadata)
                uid = user_meta.get("user_id") or user_meta.get("userId") or "guest"
                update_subscription(
                    uid,
                    data_obj.get("status", "active"),
                    data_obj.get("customer"),
                    data_obj.get("subscription"),
                    plan_type=user_meta.get("plan"),
                )
            elif evt_type == "customer.subscription.deleted":
                metadata = data_obj.get("metadata") or {}
                uid = metadata.get("user_id") or metadata.get("userId") or "guest"
                update_subscription(
                    uid,
                    data_obj.get("status", "canceled"),
                    data_obj.get("customer"),
                    data_obj.get("id"),
                    plan_type="free",
                )
            return respond(200, {"received": True})

        # CORS preflight
        if (
            event.get("requestContext", {})
                .get("http", {})
                .get("method", "")
                .upper()
            == "OPTIONS"
            or (event.get("httpMethod") or "").upper() == "OPTIONS"
        ):
            return respond(200, {"ok": True})

        # Body parsing
        if "body" in event:
            raw = event.get("body") or "{}"
            if event.get("isBase64Encoded") and isinstance(raw, str):
                try:
                    raw = base64.b64decode(raw)
                except Exception:
                    # Let JSON decoding report the bad payload
                    pass
            try:
                body = json.loads(raw) if isinstance(raw, (str, bytes, bytearray)) else (raw or {})
            except json.JSONDecodeError as e:
                return respond(
                    400,
                    {
                        "error": "BadRequest",
                        "message": "Request body must be valid JSON",
                        "details": str(e),
                    },
                )
        else:
            body = event or {}

        action_raw = body.get("action", "solve")
        action_input = str(action_raw).strip()
        # Normalize action names so variants like "stripe-checkout" and
        # "stripe checkout" resolve to the same handler.
        action_key = regex.sub(r"[^a-z0-9]+", "_", action_input.lower()).strip("_")
        alias_map = {
            "stripe_checkout": "stripe_checkout",
            "stripecheckout": "stripe_checkout",
            "stripe-checkout": "stripe_checkout",
            "stripe checkout": "stripe_checkout",
            "status": "status",
            "health": "status",
            "version": "status",
        }
        action = alias_map.get(action_key, action_key)
        text = str(body.get("text") or "").strip()

        user_id = str(body.get("user_id") or "guest")
        user_role = (body.get("user_role") or ("guest" if user_id == "guest" else "user")).lower()
        session_id = body.get("session_id")
        manual_mode_input = body.get("manual_mode")

        if not config.get("ok", True) and action != "status":
            return respond(
                500,
                ensure_meta_fields(
                    {
                        "error": "ConfigError",
                        "message": "Backend configuration is incomplete. Fix the issues below and redeploy.",
                        "issues": config.get("errors", []),
                        "warnings": config.get("warnings", []),
                    },
                    user_id,
                    user_role,
                ),
            )

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
        model_choice = requested_model if requested_model in ALLOWED_MODELS else "gpt-4o-mini"

        if action == "status":
            return respond(
                200,
                ensure_meta_fields(
                    {
                        "status": "ok",
                        "git_sha": GIT_SHA,
                        "build_time": BUILD_TIME,
                        "config": config,
                        "known_actions": sorted(
                            {
                                "usage",
                                "profile",
                                "avatars",
                                "save_avatar",
                                "workspaces",
                                "save_workspaces",
                                "stripe_checkout",
                                "classify",
                                "create",
                                "load",
                                "list",
                                "delete",
                                "update",
                                "manual_graph",
                                "graph",
                                "clarify_graph",
                                "solve",
                            }
                        ),
                    },
                    user_id,
                    user_role,
                ),
            )

        if action in {"user_state", "load_user_state", "state"}:
            profile = build_profile_payload(user_id, user_role)
            return respond(200, profile)

        if action == "usage":
            profile = build_profile_payload(user_id, user_role)
            return respond(200, profile)

        if action == "profile":
            profile = build_profile_payload(user_id, user_role)
            return respond(200, profile)

        if action == "avatars":
            profile = build_profile_payload(user_id, user_role)
            return respond(
                200,
                ensure_meta_fields(
                    {"avatars": profile.get("avatars", {}), "usage": profile.get("usage")},
                    user_id,
                    user_role,
                    usage_info=profile.get("usage"),
                ),
            )

        if action in {"save_avatar", "update_avatar"}:
            record = get_usage_record(user_id, user_role)
            updated = False
            if "user_avatar" in body:
                record["user_avatar"] = str(body.get("user_avatar"))
                updated = True
            if "tutor_avatar" in body:
                record["tutor_avatar"] = str(body.get("tutor_avatar"))
                updated = True
            if "persona" in body:
                record["tutor_avatar"] = str(body.get("persona"))
                updated = True
            if updated:
                usage_table.put_item(Item=record)
            profile = build_profile_payload(user_id, user_role, record=record)
            return respond(200, profile)

        if action in {"save_persona", "update_persona", "persona"}:
            record = get_usage_record(user_id, user_role)
            persona_choice = body.get("persona")
            if persona_choice:
                record["tutor_avatar"] = str(persona_choice)
                usage_table.put_item(Item=record)
            profile = build_profile_payload(user_id, user_role, record=record)
            return respond(200, profile)

        if action in {"workspaces", "workspace_list"}:
            profile = build_profile_payload(user_id, user_role)
            return respond(
                200,
                ensure_meta_fields(
                    {"workspaces": profile.get("workspaces", [])},
                    user_id,
                    user_role,
                    usage_info=profile.get("usage"),
                ),
            )

        if action in {"save_workspaces", "workspace_save"}:
            record = get_usage_record(user_id, user_role)
            workspaces_payload = body.get("workspaces")
            if isinstance(workspaces_payload, list):
                record["workspaces"] = workspaces_payload
                usage_table.put_item(Item=record)
            profile = build_profile_payload(user_id, user_role, record=record)
            return respond(200, profile)

        if action in {"mode", "update_mode", "save_mode"}:
            record = get_usage_record(user_id, user_role)
            requested_mode = str(body.get("mode") or body.get("active_mode") or "").lower()
            if requested_mode in ALLOWED_MODES:
                record["mode"] = requested_mode
                usage_table.put_item(Item=record)
            profile = build_profile_payload(user_id, user_role, record=record)
            return respond(200, profile)

        if action in {"stripe_checkout", "stripe-checkout", "stripe checkout"}:
            plan_choice = str(body.get("plan") or "student").lower()
            if plan_choice not in {"student", "pro"}:
                plan_choice = "student"
            price_id = None
            if plan_choice == "pro":
                price_id = body.get("price_id") or STRIPE_PRICE_PRO
            else:
                price_id = body.get("price_id") or STRIPE_PRICE_STUDENT
            if not price_id:
                return respond(
                    400,
                    ensure_meta_fields(
                        {"error": "Missing Stripe price_id for selected plan"},
                        user_id,
                        user_role,
                    ),
                )
            try:
                stripe_api_key = _get_stripe_api_key()
            except Exception as e:
                return respond(
                    500,
                    ensure_meta_fields(
                        {"error": "StripeConfigError", "message": str(e)},
                        user_id,
                        user_role,
                    ),
                )
            if not stripe_api_key:
                return respond(
                    500,
                    ensure_meta_fields(
                        {"error": "StripeConfigError", "message": "Stripe secret is empty"},
                        user_id,
                        user_role,
                    ),
                )
            try:
                stripe.api_key = stripe_api_key
                session = stripe.checkout.Session.create(
                    mode="subscription",
                    line_items=[{"price": price_id, "quantity": 1}],
                    success_url=body.get("success_url") or SUCCESS_URL,
                    cancel_url=body.get("cancel_url") or CANCEL_URL,
                    metadata={"user_id": user_id, "plan": plan_choice},
                )
                return respond(
                    200,
                    ensure_meta_fields(
                        {
                            "checkout_url": session.url,
                            "usage": calculate_usage_info(user_id, user_role),
                            "plan": plan_choice,
                        },
                        user_id,
                        user_role,
                    ),
                )
            except Exception as e:
                return respond(
                    500,
                    ensure_meta_fields(
                        {"error": "StripeError", "message": str(e)},
                        user_id,
                        user_role,
                    ),
                )

        # classification endpoint
        if action == "classify":
            gate = enforce_model_access(user_id, user_role, model_choice)
            if gate:
                return gate
            if not image_list:
                return respond(
                    400,
                    ensure_meta_fields(
                        {"error": "Image required for classification"}, user_id, user_role
                    ),
                )
            is_graph = asyncio.run(is_graph_image(image_list[0], model_choice))
            return respond(
                200,
                ensure_meta_fields(
                    {"classification": "graph" if is_graph else "not_graph"},
                    user_id,
                    user_role,
                ),
            )

        # CRUD
        if action == "create":
            item = create_session(
                user_id,
                session_id,
                body.get("title") or "New Chat",
                manual_mode=manual_mode_input or False,
            )
            return respond(200, ensure_meta_fields(clean_decimals(item), user_id, user_role))
        if action == "load":
            item = get_session(user_id, session_id)
            return respond(200, ensure_meta_fields(clean_decimals(item or {}), user_id, user_role))
        if action == "list":
            items = list_sessions(user_id)
            return respond(200, ensure_meta_fields(clean_decimals(items), user_id, user_role))
        if action == "delete":
            delete_session(user_id, session_id)
            return respond(200, ensure_meta_fields({"deleted": True}, user_id, user_role))
        if action == "update":
            if not user_id or not session_id:
                return respond(
                    400,
                    ensure_meta_fields({"error": "Missing user_id or session_id"}, user_id, user_role),
                )
            update_fields = {}
            if "title" in body and body["title"] is not None:
                update_fields["title"] = body["title"]
            if "manual_mode" in body:
                update_fields["manual_mode"] = bool(body["manual_mode"])
            if not update_fields:
                return respond(
                    400,
                    ensure_meta_fields({"error": "Nothing to update"}, user_id, user_role),
                )
            update_session(user_id, session_id, update_fields)
            return respond(
                200,
                ensure_meta_fields(
                    {"message": "Session updated", "updated": update_fields}, user_id, user_role
                ),
            )
        if action == "manual_graph":
            features = body.get("graph_features") or {}
            result = analyze_graph_from_features(features)
            if user_id and session_id and get_session(user_id, session_id):
                append_message(user_id, session_id, "user", "[Manual graph features submitted]")
                append_message(user_id, session_id, "assistant", result.get("analysis", ""))
            return respond(200, ensure_meta_fields(clean_decimals(result), user_id, user_role))
        if manual_mode_input is not None and user_id and session_id and get_session(user_id, session_id):
            update_manual_mode(user_id, session_id, manual_mode_input)

        # GRAPH
        if action == "graph":
            gate = enforce_usage(user_id, user_role, model_choice)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return respond(
                    400,
                    ensure_meta_fields(
                        {"error": "Image required for graph analysis"}, user_id, user_role
                    ),
                )

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
            usage_info = increment_usage(user_id, user_role)
            payload["usage"] = usage_info
            return respond(
                200,
                ensure_meta_fields(clean_decimals(payload), user_id, user_role, usage_info=usage_info),
            )

        # CLARIFY GRAPH
        if action == "clarify_graph":
            gate = enforce_model_access(user_id, user_role, model_choice)
            if gate:
                return gate
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return respond(
                    400,
                    ensure_meta_fields(
                        {"error": "Image required for graph clarification"},
                        user_id,
                        user_role,
                    ),
                )
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
            return respond(200, ensure_meta_fields(clean_decimals(payload), user_id, user_role))

        # SOLVE (unchanged structure, now multi-image)
        if action == "solve":
            gate = enforce_usage(user_id, user_role, model_choice)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
            if not text and not image_list:
                return respond(
                    400,
                    ensure_meta_fields({"error": "No input provided."}, user_id, user_role),
                )
            if not text and image_list:
                text = "Extract all problems from this image and solve them."
            session = get_session(user_id, session_id) if (user_id and session_id) else None
            history = session.get("messages", []) if session else []
            profile_record = get_usage_record(user_id, user_role)
            messages = [{"role": "system", "content": _persona_prompt(profile_record.get("persona"), profile_record.get("plan"))}]
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
                return respond(
                    400,
                    ensure_meta_fields({"error": "No input provided."}, user_id, user_role),
                )
            messages.append({"role": "user", "content": user_content})
            chat_res = asyncio.run(_chat(messages, 1400))
            if "error" in chat_res:
                return respond(
                    500,
                    ensure_meta_fields(
                        {"error": "OpenAIError", "details": chat_res["error"]},
                        user_id,
                        user_role,
                    ),
                )
            reply = chat_res["text"]
            code = ""
            code_match = regex.search(r"```(?:python)?(.*?)```", reply, flags=regex.S)
            code = code_match.group(1).strip() if code_match else ""
            if code and not _verify_expression(code):
                fix_res = asyncio.run(_chat([{"role": "system", "content": "Fix this SymPy code to match the solution."}, {"role": "user", "content": code}], 300))
                if "error" in fix_res:
                    return respond(
                        500,
                        ensure_meta_fields(
                            {"error": "OpenAIError", "details": fix_res["error"]},
                            user_id,
                            user_role,
                        ),
                    )
                fixed = regex.search(r"```(?:python)?(.*?)```", fix_res["text"], flags=regex.S)
                if fixed:
                    code = fixed.group(1).strip()
            result = _exec(code) if code else ""
            if user_id and session_id and session:
                append_message(user_id, session_id, "user", text)
                append_message(user_id, session_id, "assistant", reply)
            usage_info = increment_usage(user_id, user_role)
            return respond(
                200,
                ensure_meta_fields(
                    clean_decimals(
                        {
                            "expression": code or "",
                            "result": result or "",
                            "steps": reply or "",
                            "usage": usage_info,
                        }
                    ),
                    user_id,
                    user_role,
                    usage_info=usage_info,
                ),
            )

        return respond(
            400,
            ensure_meta_fields({"error": f"Unknown action: {action_raw}"}, user_id, user_role),
        )

    except Exception as exc:
        traceback.print_exc()
        return respond(
            500,
            ensure_meta_fields(
                {
                    "error": "Internal server error",
                    "message": str(exc),
                    "config": _config_status(force_refresh=True),
                },
                user_id if "user_id" in locals() else "guest",
                user_role if "user_role" in locals() else "guest",
            ),
        )
