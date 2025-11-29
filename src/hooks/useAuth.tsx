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
    // Load user on mount and after OAuth redirect
    loadUser();
    
    // Set up a listener for when user completes OAuth flow
    const handleOAuthComplete = () => {
      console.log('Checking for OAuth session after redirect...');
      loadUser();
    };
    
    // Check if we just returned from OAuth redirect
    const checkOAuthState = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code') || urlParams.has('state')) {
        console.log('OAuth callback detected, loading user session...');
        // Give Amplify a moment to process the OAuth tokens
        setTimeout(() => {
          loadUser();
        }, 100);
      }
    };
    
    checkOAuthState();
    window.addEventListener('focus', handleOAuthComplete);
    
    return () => {
      window.removeEventListener('focus', handleOAuthComplete);
    };
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
    await signInWithRedirect({ provider: 'Google' });
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
