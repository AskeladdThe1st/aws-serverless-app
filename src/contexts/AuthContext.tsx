import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';

interface AuthContextType {
  user: any;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthenticator((context) => [context.user]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
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
