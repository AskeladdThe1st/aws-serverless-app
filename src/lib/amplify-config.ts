import { Amplify } from 'aws-amplify';

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_5HSt2LTPo',
      userPoolClientId: '5qjonso3988l4kbf9fn9909slm',
      loginWith: {
        oauth: {
          domain: 'https://us-east-15hst2ltpo.auth.us-east-1.amazoncognito.com',
          scopes: ['openid', 'email'],
          redirectSignIn: [
            'https://main.d28oxrliimrzcl.amplifyapp.com/',
            'http://localhost:3000/'
          ],
          redirectSignOut: [
            'https://main.d28oxrliimrzcl.amplifyapp.com/',
            'http://localhost:3000/'
          ],
          responseType: 'code' as const,
        },
      },
    },
  },
};

Amplify.configure(amplifyConfig);

export default amplifyConfig;
