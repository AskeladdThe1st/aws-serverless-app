import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { signIn, signUp, signOut, getCurrentUser, fetchUserAttributes, signInWithRedirect } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

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
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up Hub listener for auth events (including OAuth)
    const hubListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
        case 'signedIn':
          loadUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
        case 'tokenRefresh':
          loadUser();
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
