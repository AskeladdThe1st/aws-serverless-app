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
PROFILE_BUCKET = os.environ.get("PROFILE_BUCKET")
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

PERSONAS = {
    "classic": {
        "name": "Classic Tutor",
        "tier": "guest",
        "prompt": "Maintain the concise, verified calculus tutoring style.",
    },
    "visual": {
        "name": "Visual Guide",
        "tier": "student",
        "prompt": "Lean on visual metaphors, graphs, and intuition before formal derivations.",
    },
    "exam": {
        "name": "Exam Coach",
        "tier": "pro",
        "prompt": "Keep solutions terse, highlight common pitfalls, and add quick-check tips for exams.",
    },
}

DEFAULT_PERSONA = "classic"

# ----------------- AWS Clients -----------------
dynamo = boto3.resource("dynamodb", region_name=REGION)
sessions_table = dynamo.Table(SESSIONS_TABLE)
usage_table = dynamo.Table(USAGE_TABLE)
s3 = boto3.client("s3", region_name=REGION) if PROFILE_BUCKET else None
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
            }
            usage_table.put_item(Item=item)
            return item
        _normalize_plan(item, user_role)
        if item.get("usage_date") != today:
            item["usage_date"] = today
            item["usage_count"] = 0
            usage_table.put_item(Item=item)
        return item
    except ClientError as e:
        raise RuntimeError(
            f"DynamoDB get_usage_record failed: {e.response.get('Error', {}).get('Message', str(e))}"
        ) from e


def calculate_usage_info(user_id: str, user_role: str = "guest") -> dict:
    record = get_usage_record(user_id, user_role)
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


def _persona_allowed(plan: str, persona_id: str | None) -> bool:
    if not persona_id or persona_id not in PERSONAS:
        return False
    tier = PERSONAS[persona_id].get("tier", "guest")
    if tier == "pro":
        return plan == "pro"
    if tier == "student":
        return plan in {"student", "pro"}
    return True


def _persona_prompt(persona_id: str | None = None, plan: str | None = None) -> str:
    plan_normalized = (plan or "guest").lower()
    persona_key = persona_id if _persona_allowed(plan_normalized, persona_id) else DEFAULT_PERSONA
    persona = PERSONAS.get(persona_key) or PERSONAS[DEFAULT_PERSONA]
    prompt = persona.get("prompt")
    if prompt:
        return f"{SYSTEM_PROMPT}\n\nPersona focus: {prompt}"
    return SYSTEM_PROMPT


def _profile_payload(record: dict) -> dict:
    plan = _normalize_plan(record.copy(), "user")
    persona = record.get("persona") or DEFAULT_PERSONA
    if not _persona_allowed(plan, persona):
        persona = DEFAULT_PERSONA
    avatar_url = record.get("avatar_url") or record.get("avatarKey") or record.get("avatar")
    return {
        "persona": persona if persona in PERSONAS else DEFAULT_PERSONA,
        "avatar_url": avatar_url,
    }


def save_avatar_to_s3(user_id: str, avatar_b64: str) -> tuple[str, str]:
    if not s3 or not PROFILE_BUCKET:
        raise RuntimeError("Avatar uploads are disabled because PROFILE_BUCKET is not configured.")
    key = f"avatars/{user_id}.png"
    body = base64.b64decode(avatar_b64.split(",")[-1])
    s3.put_object(
        Bucket=PROFILE_BUCKET,
        Key=key,
        Body=body,
        ContentType="image/png",
        ACL="public-read",
    )
    url = f"https://{PROFILE_BUCKET}.s3.amazonaws.com/{key}"
    return url, key


def update_profile_record(
    user_id: str,
    user_role: str,
    persona: str | None = None,
    avatar_url: str | None = None,
    avatar_b64: str | None = None,
) -> dict:
    record = get_usage_record(user_id, user_role)
    plan = _normalize_plan(record, user_role)
    if persona and _persona_allowed(plan, persona):
        record["persona"] = persona
    if avatar_b64:
        url, key = save_avatar_to_s3(user_id, avatar_b64)
        record["avatar_url"] = url
        record["avatar_key"] = key
    elif avatar_url is not None:
        record["avatar_url"] = avatar_url
        record.pop("avatar_key", None)
    usage_table.put_item(Item=record)
    return _profile_payload(record)


def increment_usage(user_id: str, user_role: str = "guest") -> dict:
    try:
        record = get_usage_record(user_id, user_role)
        record["usage_date"] = _today()
        record["usage_count"] = int(record.get("usage_count") or 0) + 1
        usage_table.put_item(Item=record)
        return calculate_usage_info(user_id, user_role)
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


def check_model_entitlement(
    user_id: str, user_role: str, requested_model: str | None, usage_info: dict | None = None
):
    if not requested_model:
        return None
    if requested_model not in ALLOWED_MODELS:
        return respond(400, {"error": "unsupported_model", "message": "Model not available"})
    info = usage_info or calculate_usage_info(user_id, user_role)
    plan = info.get("plan")

    if requested_model in PRO_MODELS and plan != "pro":
        return respond(
            403,
            {
                "error": "pro_model_locked",
                "message": "Pro models require an active Pro subscription.",
                "usage": info,
                "upgrade_required": True,
            },
        )

    if requested_model in STUDENT_MODELS and user_role == "guest":
        return respond(
            401,
            {
                "error": "login_required",
                "message": "Sign in to use advanced models.",
                "usage": info,
                "login_required": True,
            },
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
                {
                    "error": "guest_limit_reached",
                    "message": "Guests get 4 problems per day. Log in for more.",
                    "usage": info,
                    "login_required": True,
                },
            )
        return respond(
            429,
            {
                "error": "limit_reached",
                "message": "Daily limit reached. Upgrade to continue.",
                "usage": info,
                "upgrade_required": True,
            },
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
            UpdateExpression=(
                "SET messages = list_append(if_not_exists(messages, :empty_list), :msg), "
                "updatedAt = :t"
            ),
            ExpressionAttributeValues={
                ":msg": [{"role": role, "content": content, "ts": now}],
                ":t": now,
                ":empty_list": [],
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

        if not config.get("ok", True) and action != "status":
            return respond(
                500,
                {
                    "error": "ConfigError",
                    "message": "Backend configuration is incomplete. Fix the issues below and redeploy.",
                    "issues": config.get("errors", []),
                    "warnings": config.get("warnings", []),
                },
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

        user_id = str(body.get("user_id") or "guest")
        user_role = (body.get("user_role") or ("guest" if user_id == "guest" else "user")).lower()
        session_id = body.get("session_id")
        manual_mode_input = body.get("manual_mode")

        if action == "status":
            return respond(
                200,
                {
                    "status": "ok",
                    "git_sha": GIT_SHA,
                    "build_time": BUILD_TIME,
                    "config": config,
                    "known_actions": sorted(
                        {
                            "usage",
                            "stripe_checkout",
                            "classify",
                            "create",
                            "load",
                            "list",
                            "delete",
                            "update",
                            "profile",
                            "manual_graph",
                            "graph",
                            "clarify_graph",
                            "solve",
                        }
                    ),
                },
            )

        if action == "usage":
            return respond(200, {"usage": calculate_usage_info(user_id, user_role)})

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
                return respond(400, {"error": "Missing Stripe price_id for selected plan"})
            try:
                stripe_api_key = _get_stripe_api_key()
            except Exception as e:
                return respond(500, {"error": "StripeConfigError", "message": str(e)})
            if not stripe_api_key:
                return respond(500, {"error": "StripeConfigError", "message": "Stripe secret is empty"})
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
                    {
                        "checkout_url": session.url,
                        "usage": calculate_usage_info(user_id, user_role),
                    },
                )
            except Exception as e:
                return respond(500, {"error": "StripeError", "message": str(e)})

        # classification endpoint
        if action == "classify":
            gate = enforce_model_access(user_id, user_role, model_choice)
            if gate:
                return gate
            if not image_list:
                return respond(400, {"error": "Image required for classification"})
            is_graph = asyncio.run(is_graph_image(image_list[0], model_choice))
            return respond(200, {"classification": "graph" if is_graph else "not_graph"})

        # CRUD
        if action == "create":
            item = create_session(
                user_id,
                session_id,
                body.get("title") or "New Chat",
                manual_mode=manual_mode_input or False,
            )
            return respond(200, clean_decimals(item))
        if action == "load":
            item = get_session(user_id, session_id)
            return respond(200, clean_decimals(item or {}))
        if action == "list":
            items = list_sessions(user_id)
            return respond(200, clean_decimals(items))
        if action == "delete":
            delete_session(user_id, session_id)
            return respond(200, {"deleted": True})
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
        if action == "profile":
            if not user_id:
                return respond(400, {"error": "user_id_required"})
            operation = (body.get("operation") or "get").lower()
            persona_choice = body.get("persona")
            avatar_b64 = body.get("avatar_data")
            avatar_url = body.get("avatar_url")
            if operation == "get":
                record = get_usage_record(user_id, user_role)
                return respond(200, {"profile": _profile_payload(record)})
            if operation == "update":
                try:
                    profile = update_profile_record(
                        user_id,
                        user_role,
                        persona=persona_choice,
                        avatar_url=avatar_url,
                        avatar_b64=avatar_b64,
                    )
                    return respond(200, {"profile": profile})
                except Exception as exc:
                    return respond(400, {"error": "profile_update_failed", "message": str(exc)})
            return respond(400, {"error": "invalid_profile_operation"})
        if action == "manual_graph":
            features = body.get("graph_features") or {}
            result = analyze_graph_from_features(features)
            if user_id and session_id and get_session(user_id, session_id):
                append_message(user_id, session_id, "user", "[Manual graph features submitted]")
                append_message(user_id, session_id, "assistant", result.get("analysis", ""))
            return respond(200, clean_decimals(result))
        if manual_mode_input is not None and user_id and session_id and get_session(user_id, session_id):
            update_manual_mode(user_id, session_id, manual_mode_input)

        # GRAPH
        if action == "graph":
            gate = enforce_usage(user_id, user_role, model_choice)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return respond(400, {"error": "Image required for graph analysis"})

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
            return respond(200, clean_decimals(payload))

        # CLARIFY GRAPH
        if action == "clarify_graph":
            gate = enforce_model_access(user_id, user_role, model_choice)
            if gate:
                return gate
            graph_image = image_list[0] if image_list else None
            if not graph_image:
                return respond(400, {"error": "Image required for graph clarification"})
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
            return respond(200, clean_decimals(payload))

        # SOLVE (unchanged structure, now multi-image)
        if action == "solve":
            gate = enforce_usage(user_id, user_role, model_choice)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
            if not text and not image_list:
                return respond(400, {"error": "No input provided."})
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
                return respond(400, {"error": "No input provided."})
            messages.append({"role": "user", "content": user_content})
            chat_res = asyncio.run(_chat(messages, 1400))
            if "error" in chat_res:
                return respond(500, {"error": "OpenAIError", "details": chat_res["error"]})
            reply = chat_res["text"]
            code = ""
            code_match = regex.search(r"```(?:python)?(.*?)```", reply, flags=regex.S)
            code = code_match.group(1).strip() if code_match else ""
            if code and not _verify_expression(code):
                fix_res = asyncio.run(_chat([{"role": "system", "content": "Fix this SymPy code to match the solution."}, {"role": "user", "content": code}], 300))
                if "error" in fix_res:
                    return respond(500, {"error": "OpenAIError", "details": fix_res["error"]})
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
                clean_decimals(
                    {
                        "expression": code or "",
                        "result": result or "",
                        "steps": reply or "",
                        "usage": usage_info,
                    }
                ),
            )

        return respond(400, {"error": f"Unknown action: {action_raw}"})

    except Exception as exc:
        traceback.print_exc()
        return respond(
            500,
            {
                "error": "Internal server error",
                "message": str(exc),
                "config": _config_status(force_refresh=True),
            },
        )
