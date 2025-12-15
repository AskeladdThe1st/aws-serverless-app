# Creating a Pull Request for this repo

If you're trying to open a PR for the backend fixes and the UI says you can't, here are the common blockers and how to fix them:

1. **Make sure you pushed a branch**
   - From this workspace run:
     ```bash
     git push origin work
     ```
     Replace `work` with whatever branch name you're using.

2. **Verify the branch exists on GitHub**
   - In the GitHub UI, confirm the branch shows up in the branch dropdown. If it isn't there, the push failed (usually due to missing remote permissions).

3. **Check repository permissions**
   - You need `write` access to push branches and open PRs. If you only have `read` access you'll see PR creation disabled—ask a repo admin to grant write access or open the PR from their fork.

4. **Branch protection rules**
   - If `main` is protected, you must target it from a feature branch; you cannot push directly. Create a branch locally, push it, then open the PR against `main`.

5. **GitHub Actions deploy workflow inputs**
   - The backend deploy workflow still expects repository variables `AWS_REGION`, `ECR_REPOSITORY`, `LAMBDA_FUNCTION_NAME` and the secret `AWS_DEPLOY_ROLE_ARN`. Without them, even if the PR opens, the deployment job will fail after merge. Confirm these are configured in the repo settings.

6. **Retry with the PR button**
   - Once the branch is visible and you have write access, click **Pull Requests** → **New pull request**, select your branch as the compare branch, and proceed.

If you're still blocked, grab the exact UI error and we can diagnose further. This file exists so future contributors don't hit the same PR roadblocks.
