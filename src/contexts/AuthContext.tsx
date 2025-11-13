import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  useEffect(() => {
    // Check initial auth state - wrapped in try/catch to handle missing Amplify config
    const initAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        // Amplify not configured or user not authenticated - this is fine for guest mode
        console.log('Auth not configured or user not logged in - continuing as guest');
        setUser(null);
      }
    };
    
    initAuth();
    
    // Listen for auth changes - only if Amplify is available
    try {
      const unsubscribe = Hub.listen('auth', ({ payload }) => {
        if (payload.event === 'signedIn' || payload.event === 'signedOut') {
          initAuth();
        }
      });
      
      return () => unsubscribe();
    } catch (error) {
      // Hub not available - continue without auth listener
      console.log('Auth Hub not available - auth changes won\'t be detected');
    }
  }, []);
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        showAuthModal,
        openAuthModal: () => setShowAuthModal(true),
        closeAuthModal: () => setShowAuthModal(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
