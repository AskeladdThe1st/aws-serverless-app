# AWS Setup Instructions - Zero Code, Console Only

Follow these numbered steps **exactly** in the AWS Console to deploy your Calculus Agent.

---

## Part 1: Store OpenAI API Key in Secrets Manager

1. Go to **AWS Console** → Search for **Secrets Manager** → Click **Secrets Manager**
2. Click **Store a new secret**
3. Select **Other type of secret**
4. Under **Key/value pairs**, click **Plaintext** tab
5. Paste this JSON (replace with your actual OpenAI key):
   ```json
   {
     "OPENAI_API_KEY": "sk-proj-your-actual-openai-key-here"
   }
   ```
6. Click **Next**
7. For **Secret name**, type exactly: `calculus-agent/openai-key`
8. Click **Next** (skip rotation)
9. Click **Next** (skip resource permissions)
10. Click **Store**

✅ **Done!** Copy the **Secret ARN** (you'll need it in Part 2, Step 15)

---

## Part 2: Create Lambda Function

1. Go to **AWS Console** → Search for **Lambda** → Click **Lambda**
2. Click **Create function**
3. Select **Author from scratch**
4. Function name: `calculus-agent`
5. Runtime: **Python 3.12**
6. Architecture: **x86_64**
7. Click **Create function**

### Add OpenAI Layer

8. Scroll down to **Layers** section
9. Click **Add a layer**
10. Select **AWS layers**
11. In the dropdown, search for and select: **AWSLambdaPowertoolsPythonV3-python312-x86_64** (or similar OpenAI-compatible layer)
    - *Note: If no OpenAI layer is available, you'll need to create a custom layer with the OpenAI package. See instructions at end.*
12. Select the **latest version**
13. Click **Add**

### Grant Secrets Manager Permissions

14. Click **Configuration** tab → **Permissions**
15. Click the **Role name** (it will open in a new tab)
16. Click **Add permissions** → **Attach policies**
17. Search for `SecretsManagerReadWrite`
18. Check the box next to **SecretsManagerReadWrite**
19. Click **Add permissions**
20. Close the IAM tab and return to Lambda

### Configure Function Settings

21. Click **Configuration** tab → **General configuration** → **Edit**
22. Set **Memory**: `512 MB`
23. Set **Timeout**: `30 seconds`
24. Click **Save**

### Add Function Code

25. Click **Code** tab
26. Delete all existing code in `lambda_function.py`
27. Copy the entire contents of `lambda_function.py` (from this repo)
28. Paste into the Lambda editor
29. Click **Deploy**

### Enable Function URL

30. Click **Configuration** tab → **Function URL**
31. Click **Create function URL**
32. Auth type: **NONE** (public access)
33. Click **Save**
34. **Copy the Function URL** (you'll need it for the frontend!)

✅ **Done!** Your Lambda is ready. Test it with:
```bash
curl -X POST YOUR_FUNCTION_URL_HERE \
  -H "Content-Type: application/json" \
  -d '{"text": "What is the derivative of x^2?"}'
```

---

## Part 3: Deploy Frontend to AWS Amplify

### Prepare the HTML file

1. Open `public/standalone.html` from this repo
2. Find the line: `const LAMBDA_URL = 'YOUR_LAMBDA_FUNCTION_URL_HERE';`
3. Replace with your actual Lambda Function URL from Part 2, Step 34
4. Save the file as `index.html`

### Create GitHub Repository

5. Go to **GitHub.com** → Click **New repository**
6. Repository name: `calculus-agent`
7. Set to **Public**
8. Check **Add a README file**
9. Click **Create repository**
10. Click **Add file** → **Upload files**
11. Upload your `index.html` file (with Lambda URL configured)
12. Click **Commit changes**

### Deploy with Amplify Hosting

13. Go to **AWS Console** → Search for **Amplify** → Click **AWS Amplify**
14. Click **Get started** under **Amplify Hosting**
15. Select **GitHub** → Click **Continue**
16. Click **Authorize AWS Amplify** (login to GitHub if prompted)
17. Select your repository: `calculus-agent`
18. Branch: `main`
19. Click **Next**
20. Build settings: **Leave as default** (Amplify will auto-detect static HTML)
21. Click **Next**
22. Click **Save and deploy**

### Wait for Deployment

23. Wait 2-3 minutes for deployment to complete
24. When status shows **"Deployed"**, click the **Amplify URL** (e.g., `https://main.xxxxx.amplifyapp.com`)

✅ **Done!** Your app is live!

---

## Part 4: Update Frontend with Lambda URL (if skipped earlier)

If you deployed without configuring the Lambda URL:

1. Go to your **GitHub repository**
2. Click `index.html` → **Edit** (pencil icon)
3. Find: `const LAMBDA_URL = 'YOUR_LAMBDA_FUNCTION_URL_HERE';`
4. Replace with your Lambda Function URL
5. Click **Commit changes**
6. Amplify will automatically redeploy (wait 1-2 minutes)

---

## Testing Your App

1. Go to your Amplify URL
2. Type a calculus problem like: `What is the derivative of x^3?`
3. Click **Send**
4. You should see the solution with steps!

Or upload an image of a math problem using the camera/image buttons.

---

## Troubleshooting

### If Lambda returns errors:

1. Go to **Lambda** → **calculus-agent** → **Monitor** → **View CloudWatch logs**
2. Check for error messages

### Common issues:

- **"Unable to import module"**: You need to add the OpenAI layer (Part 2, Steps 8-13)
- **"Access denied to Secrets Manager"**: Repeat Part 2, Steps 14-20
- **"Lambda timeout"**: Increase timeout to 60 seconds (Part 2, Step 23)

---

## Creating a Custom OpenAI Layer (if no AWS layer available)

If AWS doesn't provide an OpenAI layer:

1. On your **local computer** (requires Python 3.12):
   ```bash
   mkdir python
   pip install openai -t python/
   zip -r openai-layer.zip python
   ```

2. Go to **Lambda** → **Layers** → **Create layer**
3. Name: `openai-python312`
4. Upload `openai-layer.zip`
5. Compatible runtimes: **Python 3.12**
6. Click **Create**
7. Return to Part 2, Step 8 and select **Custom layers** → **openai-python312**

---

## Summary Checklist

- [ ] OpenAI API key stored in Secrets Manager
- [ ] Lambda function created with Python 3.12
- [ ] OpenAI layer attached to Lambda
- [ ] Secrets Manager permissions granted
- [ ] Lambda code deployed
- [ ] Function URL enabled and copied
- [ ] GitHub repo created with `index.html`
- [ ] Lambda URL configured in `index.html`
- [ ] Amplify app deployed
- [ ] App tested successfully

🎉 **You're done! No CLI, no Docker, no zip uploads!**
