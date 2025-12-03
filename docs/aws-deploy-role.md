# AWS deploy role for GitHub Actions

This repository uses `.github/workflows/backend-lambda-ecr.yml` to build the backend Lambda container image from `backend/`, push it to Amazon ECR, and update the Lambda function on every push to the `main` branch. The workflow relies on repository variables `AWS_REGION`, `ECR_REPOSITORY`, and `LAMBDA_FUNCTION_NAME`, plus the `AWS_DEPLOY_ROLE_ARN` secret for assuming an IAM role via GitHub OIDC.

## How deployment works (beginner quick-start)

1. Make your code changes under `backend/` and push them to the `main` branch (or merge a pull request into `main`).
2. GitHub Actions runs `.github/workflows/backend-lambda-ecr.yml`, which:
   - Assumes the IAM role identified by `AWS_DEPLOY_ROLE_ARN` using GitHub OIDC.
   - Builds the Docker image defined by `backend/Dockerfile` and tags it with the commit SHA.
   - Logs in to Amazon ECR and pushes the new image to the repository named in `vars.ECR_REPOSITORY`.
   - Calls `aws lambda update-function-code --image-uri <new image>` for the function named in `vars.LAMBDA_FUNCTION_NAME` so the Lambda picks up the fresh container.
3. No manual Docker push is needed from your machine; the workflow handles building and shipping the image automatically whenever `main` changes.
4. To verify the deployment, open the Lambda function in the AWS Console and check that the image URI matches the latest commit SHA tag pushed by the workflow.

If you are new to AWS permissions, ensure the IAM role at `AWS_DEPLOY_ROLE_ARN` has the trust and permissions policies below and that the GitHub repo variables/secrets are set. Once those are in place, you only need to commit and push to `main` for Lambda to update.

## Trust policy (for the GitHub OIDC role)

Replace `<AWS_ACCOUNT_ID>`, `<OWNER>`, and `<REPO>` with your AWS account ID and GitHub repository owner/name. Restricting the `sub` condition to `main` matches the workflow trigger branch.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<OWNER>/<REPO>:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

## Permissions policy (attach to the same role)

Replace `<AWS_ACCOUNT_ID>`, `<AWS_REGION>`, `<ECR_REPOSITORY>`, and `<LAMBDA_FUNCTION_NAME>` with the values used in your repository variables.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrLogin",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "EcrPushToRepository",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:<AWS_REGION>:<AWS_ACCOUNT_ID>:repository/<ECR_REPOSITORY>"
    },
    {
      "Sid": "LambdaUpdateImage",
      "Effect": "Allow",
      "Action": [
        "lambda:UpdateFunctionCode",
        "lambda:GetFunction"
      ],
      "Resource": "arn:aws:lambda:<AWS_REGION>:<AWS_ACCOUNT_ID>:function:<LAMBDA_FUNCTION_NAME>"
    }
  ]
}
```
