import { Amplify } from "aws-amplify";

const productionRedirectUrl = "https://main.dxslzdzugej3p.amplifyapp.com/";
const currentRedirectUrl =
  typeof window !== "undefined" ? `${window.location.origin}/` : productionRedirectUrl;
const redirectUrls = Array.from(
  new Set([currentRedirectUrl, productionRedirectUrl, "http://localhost:3000/", "http://localhost:5173/"])
);

const amplifyConfig = {
  Auth: {
    Cognito: {
      // Region is required so tokens can be fetched/stored correctly
      region: "us-east-1",
      userPoolId: "us-east-1_5HSt2LTPo",
      userPoolClientId: "20ink54fvlk7a5mgcp0n95ikad",
      // Persist tokens in local storage to avoid third-party cookie blocking
      loginWith: {
        oauth: {
          domain: "us-east-15hst2ltpo.auth.us-east-1.amazoncognito.com",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: redirectUrls,
          redirectSignOut: redirectUrls,
          responseType: "code" as const,
        },
      },
    },
  },
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
