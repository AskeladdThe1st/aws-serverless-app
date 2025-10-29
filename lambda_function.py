import json, re, boto3, asyncio
from openai import AsyncOpenAI
from sympy import symbols, integrate
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations,
    convert_xor, implicit_multiplication_application,
)

TRANSFORMS = standard_transformations + (convert_xor, implicit_multiplication_application)

def _cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

def _clean_expr(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"```.*?```", "", s, flags=re.S)
    return s.strip().strip("`'\" ").replace("^", "**").replace("\\(", "").replace("\\)", "")

# ---------- async helpers ----------
async def _get_expr(client: AsyncOpenAI, user_text: str, image_b64: str | None) -> str:
    system = "Return ONLY the raw SymPy expression, no words, no code blocks. Example: input 'integrate x^2' → x**3/3"
    messages = [{"role": "system", "content": system}]
    if image_b64:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_text},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
            ],
        })
    else:
        messages.append({"role": "user", "content": user_text})
    reply = await client.chat.completions.create(
        model="gpt-4-turbo", temperature=0, messages=messages, max_tokens=60
    )
    return _clean_expr(reply.choices[0].message.content.strip())

async def _get_steps(client: AsyncOpenAI, expr: str, result: str) -> str:
    msg = [{"role": "user", "content": f"Explain step-by-step: {expr}\nResult: {result}"}]
    reply = await client.chat.completions.create(
        model="gpt-4-turbo", temperature=0, messages=msg, max_tokens=300
    )
    return reply.choices[0].message.content.strip()

# ---------- Lambda entry ----------
def lambda_handler(event, context):
    method = (
        (event or {}).get("requestContext", {}).get("http", {}).get("method")
        or (event or {}).get("httpMethod")
        or ""
    ).upper()
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors(), "body": json.dumps({"ok": True})}

    try:
        body = json.loads((event or {}).get("body") or "{}")
    except Exception:
        body = {}
    user_text = (body.get("prompt") or body.get("text") or "Integrate x^2").strip()
    image_b64 = body.get("image")

    secret = boto3.client("secretsmanager").get_secret_value(SecretId="calculus-agent/openai-key")
    async_client = AsyncOpenAI(api_key=secret["SecretString"])

    # run both calls in parallel
    async def main():
        expr_task = _get_expr(async_client, user_text, image_b64)
        expr_raw = await expr_task
        try:
            expr = parse_expr(expr_raw, transformations=TRANSFORMS, evaluate=False)
            var = list(expr.free_symbols)[0] if expr.free_symbols else symbols("x")
            result = str(integrate(expr, var))
        except Exception as e:
            result = f"SymPy error: {e}"
        steps = await _get_steps(async_client, expr_raw, result)
        return {"expression": expr_raw, "result": result, "steps": steps}

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        payload = loop.run_until_complete(main())
    finally:
        loop.close()

    return {"statusCode": 200, "headers": _cors(), "body": json.dumps(payload)}
