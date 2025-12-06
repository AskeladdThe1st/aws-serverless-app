# Backend Lambda environment setup

Use this checklist to ensure the Lambda container has the AWS resources and environment variables it expects. Values mirror the defaults in `backend/lambda_function.py`, so overrides must match your deployed resources and Secrets Manager names.

## AWS resources to create/configure
1. **DynamoDB tables**
   - `calculus_sessions` (or set `SESSIONS_TABLE` to your table name) with `user_id` (partition key) and `session_id` (sort key).
   - `calculus_usage` (or set `USAGE_TABLE`) with `user_id` (partition key).
2. **Secrets Manager entries** (if you are not providing keys directly as env vars)
   - `calculus-agent/openai-key` (override with `OPENAI_SECRET_NAME` if you use a different path). Store either a raw string API key or JSON like `{ "api_key": "..." }`.
   - `calculus-agent/stripe-secret` (override with `STRIPE_SECRET_NAME`). JSON keys `api_key` or `secret` are supported, or a raw secret string.
   - `calculus-agent/stripe-webhook` (override with `STRIPE_WEBHOOK_SECRET_NAME`). JSON key `secret` is supported, or a raw webhook secret string.
3. **ECR repository**
   - The workflow pushes the backend image to the repository set in `ECR_REPOSITORY` and updates the Lambda image. Ensure your deploy role can push to the repo and update the Lambda function.

## Lambda environment variables
Set these on the Lambda function (or in your deploy workflow variables) so the container starts with the right configuration:

| Variable | Purpose | Recommended value |
| --- | --- | --- |
| `AWS_DEFAULT_REGION` | Region for DynamoDB/Secrets. | Your AWS region (e.g., `us-east-1`). |
| `SESSIONS_TABLE` | DynamoDB table for chat sessions. | `calculus_sessions` or your custom table. |
| `USAGE_TABLE` | DynamoDB table for per-user usage/plan state. | `calculus_usage` or your custom table. |
| `OPENAI_API_KEY` | OpenAI key (skip if using Secrets Manager). | Your OpenAI key. |
| `OPENAI_SECRET_NAME` | Secrets Manager name for OpenAI key. | `calculus-agent/openai-key` (if not using `OPENAI_API_KEY`). |
| `STRIPE_SECRET_KEY` or `STRIPE_API_KEY` | Stripe secret (skip if using Secrets Manager). | Your Stripe secret key. |
| `STRIPE_SECRET_NAME` | Secrets Manager name for Stripe secret. | `calculus-agent/stripe-secret` (if not using env key). |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (skip if using Secrets Manager). | Your webhook secret. |
| `STRIPE_WEBHOOK_SECRET_NAME` | Secrets Manager name for webhook secret. | `calculus-agent/stripe-webhook` (if not using env secret). |
| `STRIPE_PRICE_ID` | Default price ID used when starting checkout. | Your active Stripe price ID. |
| `STRIPE_SUCCESS_URL` | Redirect after successful checkout. | Your app success URL. |
| `STRIPE_CANCEL_URL` | Redirect after canceled checkout. | Your app cancel URL. |
| `GUEST_DAILY_LIMIT` | Daily problem limit for free users. | Integer (default `5`). |
| `CORS_ALLOW_ORIGIN` (or `AMPLIFY_APP_URL`) | **Single** allowed origin for API responses. Wildcards and comma-separated lists are ignored. | `https://main.d2binnmnc1amly.amplifyapp.com` (set to your Amplify app URL). |
| `GIT_SHA` | Injected by CI to show deployed revision. | Set by workflow. |
| `BUILD_TIME` | Injected by CI to show build time. | Set by workflow. |

**CORS is intentionally strict:** responses always send `Access-Control-Allow-Origin` set to the single configured Amplify URL, `Access-Control-Allow-Headers: content-type`, `Access-Control-Allow-Methods: POST`, and never include `Access-Control-Allow-Credentials`. Update the origin variable above if your Amplify URL changes.

## Optional/operational tips
- If you rely on Secrets Manager, ensure the Lambda execution role can `secretsmanager:GetSecretValue` for the configured secret names and `dynamodb:*` (or precise CRUD actions) on the session/usage tables.
- The Lambda returns configuration diagnostics via the `status`/`health`/`version` action. Call that endpoint to confirm the Lambda can reach DynamoDB and secrets before testing the UI.
- When changing table names or secret names, update both the Lambda env vars and any IaC/templates so the deploy workflow and runtime agree.
