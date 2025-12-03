# AWS deploy role for GitHub Actions

This repository uses `.github/workflows/backend-lambda-ecr.yml` to build the backend Lambda container image from `backend/`, push it to Amazon ECR, and update the Lambda function on every push to the `main` branch. The workflow relies on repository variables `AWS_REGION`, `ECR_REPOSITORY`, and `LAMBDA_FUNCTION_NAME`, plus the `AWS_DEPLOY_ROLE_ARN` secret for assuming an IAM role via GitHub OIDC.

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
