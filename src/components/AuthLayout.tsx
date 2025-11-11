import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';

export const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Authenticator
      formFields={{
        signIn: {
          username: {
            placeholder: 'Enter your email',
            label: 'Email',
          },
        },
        signUp: {
          username: {
            placeholder: 'Enter your email',
            label: 'Email',
            order: 1,
          },
          password: {
            placeholder: 'Enter your password',
            label: 'Password',
            order: 2,
          },
          confirm_password: {
            placeholder: 'Confirm your password',
            label: 'Confirm Password',
            order: 3,
          },
        },
      }}
      components={{
        Header() {
          return (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">∫</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Calculus Assistant</h1>
              <p className="text-muted-foreground mt-2">Sign in to save your chat history</p>
            </div>
          );
        },
      }}
    >
      {children}
    </Authenticator>
  );
};

export const AuthHeader = () => {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 ml-auto">
      <span className="text-sm text-muted-foreground hidden sm:inline">
        {user.signInDetails?.loginId || user.username}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={signOut}
        className="gap-2"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Logout</span>
      </Button>
    </div>
  );
};
