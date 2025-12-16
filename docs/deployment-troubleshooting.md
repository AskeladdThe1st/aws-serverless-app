# Backend deployment troubleshooting

The GitHub Actions workflow `.github/workflows/backend-lambda-ecr.yml` fails at the **Configure AWS credentials** step when it cannot assume your AWS role. Common causes and fixes:

1. **Missing repository secret**
   - Set the **`AWS_DEPLOY_ROLE_ARN`** secret in GitHub: `Settings → Secrets and variables → Actions → New repository secret`.
   - Value should be the full ARN of the IAM role that GitHub is allowed to assume (e.g., `arn:aws:iam::123456789012:role/github-oidc-deploy`).

2. **Missing repository variables**
   - Add these repository variables under `Settings → Secrets and variables → Actions → Variables`:
     - `AWS_REGION` – AWS region of your ECR and Lambda (e.g., `us-east-1`).
     - `ECR_REPOSITORY` – Name of the ECR repo that stores the backend image (no registry prefix).
     - `LAMBDA_FUNCTION_NAME` – Name of the Lambda function to update.

3. **Role trust policy not configured for GitHub OIDC**
   - Ensure the IAM role allows `sts:AssumeRoleWithWebIdentity` from your GitHub org/repo and branch. Example condition block:
     ```json
     {
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<account-id>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {"token.actions.githubusercontent.com:sub": "repo:<org>/<repo>:ref:refs/heads/main"}
       }
     }
     ```

4. **Role permissions too narrow**
   - The role policy must allow:
     - `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:CompleteLayerUpload`, `ecr:UploadLayerPart`, `ecr:PutImage` on the ECR repo.
     - `lambda:UpdateFunctionCode` on your Lambda function.

After adding the secret, variables, and IAM role settings above, re-run the failed GitHub Action (or push a new commit) and the pipeline will proceed past credential configuration.
