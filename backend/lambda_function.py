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
STRIPE_SECRET_NAME = os.environ.get("STRIPE_SECRET_NAME", "calculus-agent/stripe-secret")
STRIPE_WEBHOOK_SECRET_NAME = os.environ.get("STRIPE_WEBHOOK_SECRET_NAME", "calculus-agent/stripe-webhook")
DEFAULT_PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
SUCCESS_URL = os.environ.get("STRIPE_SUCCESS_URL", "https://example.com/success")
CANCEL_URL = os.environ.get("STRIPE_CANCEL_URL", "https://example.com/cancel")
GUEST_DAILY_LIMIT = int(os.environ.get("GUEST_DAILY_LIMIT", "5"))

# ----------------- AWS Clients -----------------
dynamo = boto3.resource("dynamodb", region_name=REGION)
sessions_table = dynamo.Table("calculus_sessions")
usage_table = dynamo.Table(USAGE_TABLE)


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


def _today():
    return datetime.utcnow().strftime("%Y-%m-%d")


def _get_secret_value(secret_name: str):
    sec = boto3.client("secretsmanager", region_name=REGION).get_secret_value(
        SecretId=secret_name
    )
    raw = sec.get("SecretString") or ""
    try:
        parsed = json.loads(raw)
        return parsed
    except Exception:
        return raw


def _get_stripe_api_key() -> str:
    raw = _get_secret_value(STRIPE_SECRET_NAME)
    if isinstance(raw, dict):
        return raw.get("api_key") or raw.get("secret") or raw.get("STRIPE_SECRET_KEY") or ""
    return str(raw)


def _get_webhook_secret() -> str:
    raw = _get_secret_value(STRIPE_WEBHOOK_SECRET_NAME)
    if isinstance(raw, dict):
        return raw.get("secret") or raw.get("STRIPE_WEBHOOK_SECRET") or ""
    return str(raw)


def get_usage_record(user_id: str) -> dict:
    resp = usage_table.get_item(Key={"user_id": user_id})
    item = resp.get("Item") or {}
    today = _today()
    if not item:
        item = {
            "user_id": user_id,
            "plan": "free",
            "subscription_status": "inactive",
            "usage_date": today,
            "usage_count": 0,
        }
        usage_table.put_item(Item=item)
        return item
    if item.get("usage_date") != today:
        item["usage_date"] = today
        item["usage_count"] = 0
        usage_table.put_item(Item=item)
    return item


def calculate_usage_info(user_id: str) -> dict:
    record = get_usage_record(user_id)
    status = (record.get("subscription_status") or "inactive").lower()
    limit = None if status in {"active", "trialing", "past_due"} else GUEST_DAILY_LIMIT
    used = int(record.get("usage_count") or 0)
    problems_left = None if limit is None else max(limit - used, 0)
    return {
        "plan": record.get("plan", "free"),
        "subscription_status": status,
        "limit": limit,
        "used_today": used,
        "problems_left": problems_left,
        "upgrade_required": False if limit is None else problems_left <= 0,
    }


def increment_usage(user_id: str) -> dict:
    record = get_usage_record(user_id)
    record["usage_date"] = _today()
    record["usage_count"] = int(record.get("usage_count") or 0) + 1
    usage_table.put_item(Item=record)
    return calculate_usage_info(user_id)


def update_subscription(user_id: str, status: str, customer_id: str = None, subscription_id: str = None):
    record = get_usage_record(user_id)
    record["subscription_status"] = status
    record["plan"] = "paid" if status in {"active", "trialing", "past_due"} else "free"
    if customer_id:
        record["stripe_customer_id"] = customer_id
    if subscription_id:
        record["subscription_id"] = subscription_id
    usage_table.put_item(Item=record)
    return record


def enforce_usage(user_id: str):
    info = calculate_usage_info(user_id)
    if info["limit"] is not None and info.get("problems_left", 0) <= 0:
        return respond(
            429,
            {
                "error": "limit_reached",
                "message": "Daily limit reached. Upgrade to continue.",
                "usage": info,
            },
        )
    return info

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
        headers_raw = event.get("headers") or {}
        headers = {str(k).lower(): v for k, v in headers_raw.items()}

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
                update_subscription(uid, data_obj.get("status", "active"), data_obj.get("customer"), data_obj.get("subscription"))
            elif evt_type == "customer.subscription.deleted":
                metadata = data_obj.get("metadata") or {}
                uid = metadata.get("user_id") or metadata.get("userId") or "guest"
                update_subscription(uid, data_obj.get("status", "canceled"), data_obj.get("customer"), data_obj.get("id"))
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

        if action == "usage":
            return respond(200, {"usage": calculate_usage_info(user_id)})

        if action == "stripe_checkout":
            price_id = body.get("price_id") or DEFAULT_PRICE_ID
            if not price_id:
                return respond(400, {"error": "Missing Stripe price_id"})
            try:
                stripe.api_key = _get_stripe_api_key()
                session = stripe.checkout.Session.create(
                    mode="subscription",
                    line_items=[{"price": price_id, "quantity": 1}],
                    success_url=body.get("success_url") or SUCCESS_URL,
                    cancel_url=body.get("cancel_url") or CANCEL_URL,
                    metadata={"user_id": user_id},
                )
                return respond(200, {"checkout_url": session.url, "usage": calculate_usage_info(user_id)})
            except Exception as e:
                return respond(500, {"error": "StripeError", "message": str(e)})

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
            gate = enforce_usage(user_id)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
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
            usage_info = increment_usage(user_id)
            payload["usage"] = usage_info
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
            gate = enforce_usage(user_id)
            if isinstance(gate, dict) and gate.get("statusCode"):
                return gate
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
            usage_info = increment_usage(user_id)
            return {
                "statusCode": 200,
                "body": json.dumps(
                    clean_decimals(
                        {
                            "expression": code or "",
                            "result": result or "",
                            "steps": reply or "",
                            "usage": usage_info,
                        }
                    )
                ),
            }

        return {"statusCode": 400, "body": json.dumps({"error": f"Unknown action: {action}"})}

    except Exception:
        traceback.print_exc()
        return {"statusCode": 500, "body": json.dumps({"error": "Internal server error"})}
