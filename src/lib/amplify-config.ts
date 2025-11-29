import { Amplify } from "aws-amplify";

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_5HSt2LTPo",
      userPoolClientId: "5qjonso3988l4kbf9fn9909slm",
      loginWith: {
        oauth: {
          domain: "us-east-15hst2ltpo.auth.us-east-1.amazoncognito.com",
          scopes: ["openid", "email"],
          redirectSignIn: [
            "https://main.d28oxriiimrzcl.amplifyapp.com/",
            "http://localhost:3000/",
            "https://95ff72ac-4838-479b-bf2c-ab5f0bb16e6b.lovableproject.com/",
          ],
          redirectSignOut: [
            "https://main.d28oxriiimrzcl.amplifyapp.com/",
            "http://localhost:3000/",
            "https://95ff72ac-4838-479b-bf2c-ab5f0bb16e6b.lovableproject.com/",
          ],
          responseType: "code" as const,
        },
      },
    },
  },
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
