import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signIn, signUp, signOut, getCurrentUser, fetchUserAttributes, signInWithRedirect } from 'aws-amplify/auth';

interface User {
  email: string;
  name?: string;
  picture?: string;
  isPremium: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVELOPER_EMAIL = 'developer@example.com'; // Replace with your actual developer email

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      
      const email = attributes.email || '';
      const isPremium = email === DEVELOPER_EMAIL;
      
      setUser({
        email,
        name: attributes.name || attributes.email?.split('@')[0],
        picture: attributes.picture,
        isPremium,
      });
    } catch (error) {
      console.log('No authenticated user found:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only handle OAuth callback on mount; do NOT auto-load a cached user session
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);

      // If we just returned from OAuth redirect, then load the user session
      if (urlParams.has('code') || urlParams.has('state')) {
        console.log('OAuth callback detected, loading user session...');
        // Give Amplify a moment to process the OAuth tokens
        setTimeout(() => {
          loadUser();
        }, 100);
      }
    };

    handleOAuthCallback();
  }, []);

  const login = async (email: string, password: string) => {
    await signIn({ username: email, password });
    await loadUser();
  };

  const signup = async (email: string, password: string) => {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
        },
      },
    });
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const loginWithGoogle = async () => {
    try {
      console.log('Starting Google sign-in redirect...');
      await signInWithRedirect({
        provider: 'Google',
        // Attach extra query params via a cast so we can force the
        // Google account chooser without breaking TypeScript types.
        ...( {
          extraQueryParams: {
            prompt: 'select_account',
          },
        } as any ),
      });
    } catch (error) {
      console.error('Google sign-in redirect failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
