# Project Overview
Math Tutor Agent is a React + Vite front-end hosted on AWS Amplify that talks to a Python Lambda API. The Lambda solves math problems (including image-based graph analysis), tracks usage/limits, and persists chats so users can return to past sessions.

# Architecture Overview (AWS services used and why)
- **AWS Amplify Hosting**: Serves the static React build and handles CI/CD for the UI.
- **AWS Lambda (containerized, Python)**: Stateless compute for problem solving, graph analysis, and usage enforcement.
- **Amazon DynamoDB**: `calculus_sessions` stores chat histories; `calculus_usage` tracks plan/usage limits.
- **AWS Secrets Manager**: Stores OpenAI and Stripe secrets when not provided via env vars.
- **Amazon S3** (optional): Stores uploaded avatar images when `PROFILE_BUCKET` is set.
- **Amazon ECR**: Hosts the Lambda container image produced by CI.
- **Stripe**: Billing for student/pro plans (price IDs supplied via env vars).
- **CloudWatch Logs**: Observability for Lambda runs and deployment diagnostics.

# Deployment Flow
1. Push to `main` triggers `.github/workflows/backend-lambda-ecr.yml`.
2. The workflow assumes the deploy role (`AWS_DEPLOY_ROLE_ARN`), builds the `backend/` Docker image with `GIT_SHA`/`BUILD_TIME` build args, pushes to ECR (`ECR_REPOSITORY`), and runs `aws lambda update-function-code` for `LAMBDA_FUNCTION_NAME`.
3. Amplify builds and deploys the React front-end from `main`, pointing to the Lambda Function URL (`LAMBDA_URL` in the UI code).
4. Required GitHub configuration: repository variables `AWS_REGION`, `ECR_REPOSITORY`, `LAMBDA_FUNCTION_NAME`; secret `AWS_DEPLOY_ROLE_ARN`.

# Security Considerations (IAM roles, least privilege, auth)
- **Deploy role (GitHub OIDC)**: Limit trust to this repo/branch; permissions only for ECR push and Lambda `UpdateFunctionCode`.
- **Lambda execution role**: Grant least-privilege access to DynamoDB tables (`calculus_sessions`, `calculus_usage`), Secrets Manager entries for OpenAI/Stripe/webhook, and S3 avatar bucket (if enabled).
- **Auth**: Front-end uses AWS Amplify Auth; backend enforces plan/model access and per-user limits.
- **Secrets**: Prefer Secrets Manager (`OPENAI_SECRET_NAME`, `STRIPE_SECRET_NAME`, `STRIPE_WEBHOOK_SECRET_NAME`) over inline env vars.

# Monitoring & Stability (CloudWatch)
- CloudWatch Logs capture Lambda request/response traces, configuration diagnostics (`status`/`health` action), and deployment metadata from `GIT_SHA`/`BUILD_TIME`.
- Watch for DynamoDB throttling, Secrets Manager access errors, and Stripe failures; alerts should be tied to Lambda error metrics.

# Incident & Recovery Summary
- **Recent rollback**: Production briefly served stale chat state after a deployment; resolving by redeploying the last known-good Lambda image restored persistence. Amplify/UI remained stable.
- **Current posture**: CI-driven Lambda image updates and Amplify hosting are healthy; manual run of the deploy workflow can re-pin a known-good image if needed. 
