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
| `STRIPE_PRICE_STUDENT` | Stripe price ID used for the Student Plus plan. | Your Student Plus price ID. |
| `STRIPE_PRICE_PRO` | Stripe price ID used for the Pro plan. | Your Pro price ID. |
| `STRIPE_SUCCESS_URL` | Redirect after successful checkout. | Your app success URL. |
| `STRIPE_CANCEL_URL` | Redirect after canceled checkout. | Your app cancel URL. |
| `FREE_DAILY_LIMIT` | Daily problem limit for signed-in free users. | Integer (default `15`). |
| `GUEST_DAILY_LIMIT` | Daily problem limit for guest users. | Integer (default `4`). |
| `GIT_SHA` | Injected by CI to show deployed revision. | Set by workflow. |
| `BUILD_TIME` | Injected by CI to show build time. | Set by workflow. |

**CORS is handled by the Lambda Function URL configuration.** Set allowed origins/headers/methods on the Function URL instead of injecting headers in code.

## Optional/operational tips
- If you rely on Secrets Manager, ensure the Lambda execution role can `secretsmanager:GetSecretValue` for the configured secret names and `dynamodb:*` (or precise CRUD actions) on the session/usage tables.
- The Lambda returns configuration diagnostics via the `status`/`health`/`version` action. Call that endpoint to confirm the Lambda can reach DynamoDB and secrets before testing the UI.
- When changing table names or secret names, update both the Lambda env vars and any IaC/templates so the deploy workflow and runtime agree.

## Quick AWS setup checklist
Follow these steps to make sure the Lambda can start cleanly and Stripe/OpenAI calls work:

1) **Create/update DynamoDB tables**
   - Provision `calculus_sessions` and `calculus_usage` (or your custom names) in the same region as the Lambda Function URL.
   - Confirm the Lambda execution role can read/write both tables (at minimum: `GetItem`, `PutItem`, `Query`, `UpdateItem`, and `BatchWriteItem`).

2) **Provide secrets**
   - Either set `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` as Lambda environment variables **or** create the Secrets Manager entries listed above and allow the Lambda role to call `secretsmanager:GetSecretValue` on them.

3) **Stripe products/prices**
   - Create two active Stripe prices: one for the Student Plus plan and one for the Pro plan. Copy their price IDs into `STRIPE_PRICE_STUDENT` and `STRIPE_PRICE_PRO`.
   - Point `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` at the front-end routes you want Stripe to redirect to (typically your Amplify app URLs).
   - Make sure the Stripe webhook is configured to POST to your Lambda Function URL endpoint and uses the signing secret stored in `STRIPE_WEBHOOK_SECRET` (or the named secret).

4) **Function URL configuration**
   - Enable the Lambda Function URL and set its CORS settings to your Amplify domain, `POST` method, and `Content-Type` header. Do not rely on in-code CORS headers.

5) **CI/CD variables (if you deploy from GitHub Actions)**
   - Repository variables: `AWS_REGION`, `ECR_REPOSITORY`, `LAMBDA_FUNCTION_NAME`.
   - Repository secret: `AWS_DEPLOY_ROLE_ARN` pointing at an IAM role that the GitHub OIDC provider can assume to push to ECR and update the Lambda image.
   - Optional: set `GIT_SHA` and `BUILD_TIME` during builds so the `/status` action reports the deployed revision.

6) **Smoke-test the live Lambda**
   - Invoke the `status`/`health` action via the Function URL to confirm DynamoDB and Secrets Manager are reachable and the configured price IDs are returned.
   - Send a simple `solve` or `clarify` request to verify model access works with your OpenAI key before testing from the UI.
