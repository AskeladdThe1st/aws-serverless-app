# AWS Amplify Authentication Setup

This guide will help you configure AWS Amplify Authentication (Cognito) for the Calculus Assistant application.

## Prerequisites

- AWS Account
- AWS CLI installed and configured
- Node.js and npm installed

## Step 1: Create a Cognito User Pool

1. Go to the [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click "Create user pool"
3. Configure sign-in options:
   - Select "Email" as the sign-in option
   - Click "Next"

4. Configure security requirements:
   - Password policy: Choose your preferred settings (default is fine)
   - Multi-factor authentication: Choose "Optional" or "Off"
   - Click "Next"

5. Configure sign-up experience:
   - Enable self-registration
   - Required attributes: Email
   - Click "Next"

6. Configure message delivery:
   - Email provider: Choose "Send email with Amazon SES" or "Send email with Cognito" for testing
   - Click "Next"

7. Integrate your app:
   - User pool name: `calculus-assistant-pool`
   - App client name: `calculus-assistant-client`
   - Click "Next"

8. Review and create:
   - Review your settings
   - Click "Create user pool"

## Step 2: Create an Identity Pool

1. In the Cognito console, click "Identity pools" (Federated Identities)
2. Click "Create identity pool"
3. Configure:
   - Identity pool name: `calculus-assistant-identity-pool`
   - Enable "Unauthenticated identities" (optional, for guest access)
   - Authentication providers:
     - Select "Cognito"
     - User Pool ID: (paste your user pool ID from Step 1)
     - App client ID: (paste your app client ID from Step 1)
4. Click "Create pool"

## Step 3: Update amplify_outputs.json

After creating your Cognito resources, update the `amplify_outputs.json` file in the project root with your actual values:

```json
{
  "version": "1",
  "auth": {
    "user_pool_id": "us-east-1_XXXXXXXXX",           // From Step 1
    "aws_region": "us-east-1",                        // Your AWS region
    "user_pool_client_id": "xxxxxxxxxxxxxxxxxx",      // From Step 1 (App client ID)
    "identity_pool_id": "us-east-1:xxxx-xxxx-xxxx",  // From Step 2
    "mfa_methods": [],
    "standard_required_attributes": ["email"],
    "username_attributes": ["email"],
    "user_verification_types": ["email"],
    "mfa_configuration": "OPTIONAL",
    "password_policy": {
      "min_length": 8,
      "require_lowercase": true,
      "require_numbers": true,
      "require_symbols": true,
      "require_uppercase": true
    },
    "unauthenticated_identities_enabled": true
  }
}
```

### How to Find Your Values:

1. **user_pool_id**: 
   - Go to Cognito → User pools → Your pool
   - Found in "User pool overview" section

2. **aws_region**: 
   - The region where you created the resources (e.g., `us-east-1`, `eu-west-1`)

3. **user_pool_client_id**: 
   - Go to your User pool → App integration tab
   - Click on your app client
   - Copy the "Client ID"

4. **identity_pool_id**: 
   - Go to Cognito → Identity pools → Your identity pool
   - Found in the identity pool dashboard

## Step 4: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open the application in your browser

3. You should see the Amplify Authenticator component with:
   - Sign In form
   - Create Account option

4. Test creating a new account:
   - Enter an email and password
   - Verify the email (check your inbox)
   - Sign in with your credentials

5. After signing in, you should see:
   - Your email displayed in the top-right corner
   - A "Logout" button
   - The main chat interface

## Features Enabled

With authentication configured, the following features are now available:

✅ **User Authentication**: Email/password login and signup
✅ **Session Management**: Automatic token refresh and storage
✅ **Protected Access**: User-specific chat sessions
✅ **User Context**: `user_id` sent with each Lambda request
✅ **Persistent Sessions**: Chat history per user session

## Troubleshooting

### Issue: "Unable to resolve auth configuration"
**Solution**: Make sure `amplify_outputs.json` has valid values and is in the project root.

### Issue: Email verification not working
**Solution**: 
- Check your SES configuration if using Amazon SES
- For testing, use Cognito's built-in email (limited to 50 emails/day)

### Issue: Authentication UI not appearing
**Solution**: 
- Clear browser cache and refresh
- Check browser console for errors
- Verify all Amplify packages are installed correctly

## Security Notes

🔒 **Never commit `amplify_outputs.json` with real credentials to version control**
🔒 **Use environment-specific configurations for development/production**
🔒 **Enable MFA for production environments**
🔒 **Configure proper CORS settings in your Lambda function**

## Next Steps

Once authentication is working, you can:

1. Connect to DynamoDB for persistent chat history
2. Implement user profile management
3. Add OAuth providers (Google, Facebook, etc.)
4. Configure custom email templates
5. Set up user groups and roles

For more information, visit:
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
