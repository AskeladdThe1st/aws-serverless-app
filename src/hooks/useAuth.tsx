import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signIn, signUp, signOut, getCurrentUser, fetchUserAttributes, signInWithRedirect } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface User {
  email: string;
  name?: string;
  username?: string;
  picture?: string;
  isPremium: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEVELOPER_EMAIL = 'experiencehub.yt@gmail.com';

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
        username: attributes.preferred_username || attributes['custom:username'],
        picture: attributes.picture,
        isPremium,
      });
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up Hub listener for auth events (including OAuth)
    const hubListener = Hub.listen('auth', ({ payload }) => {
      console.log('Auth event:', payload.event);
      switch (payload.event) {
        case 'signInWithRedirect':
        case 'signedIn':
          console.log('User signed in, loading user data...');
          loadUser();
          break;
        case 'signedOut':
          console.log('User signed out');
          setUser(null);
          break;
        case 'tokenRefresh':
          console.log('Token refreshed');
          loadUser();
          break;
        case 'signInWithRedirect_failure':
          console.error('OAuth sign-in failed:', payload.data);
          setLoading(false);
          break;
      }
    });

    // Check for existing session
    loadUser();

    return () => hubListener();
  }, []);

  const login = async (email: string, password: string) => {
    await signIn({ username: email, password });
    await loadUser();
  };

  const signup = async (email: string, password: string, username?: string) => {
    const userAttributes: Record<string, string> = {
      email,
    };
    
    if (username) {
      userAttributes.preferred_username = username;
    }

    await signUp({
      username: email,
      password,
      options: {
        userAttributes,
      },
    });
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const loginWithGoogle = async () => {
    try {
      console.log('Initiating Google sign-in...');
      await signInWithRedirect({ provider: 'Google' });
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
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
