import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  signIn,
  signUp,
  signOut,
  signInWithRedirect,
  fetchAuthSession,
} from "aws-amplify/auth";

interface User {
  sub?: string;
  email: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
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

const DEVELOPER_EMAIL = "developer@example.com"; // replace with yours

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const session = await fetchAuthSession();
      
      // Check if we have valid tokens
      if (!session.tokens?.idToken) {
        throw new Error("No valid session");
      }
      
      // Extract claims from ID token (no extra API call needed!)
      const claims = session.tokens.idToken.payload;
      
      const email = (claims.email as string) ?? "";
      const name =
        (claims.name as string) ||
        `${(claims.given_name as string) || ""} ${(claims.family_name as string) || ""}`.trim() ||
        email.split("@")[0];

      setUser({
        sub: claims.sub as string,
        email,
        name,
        picture: claims.picture as string,
        given_name: claims.given_name as string,
        family_name: claims.family_name as string,
        isPremium: email === DEVELOPER_EMAIL,
      });
    } catch (err) {
      console.log("No authenticated user:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("state")) {
      // Give Amplify a tick to store tokens after OAuth redirect
      setTimeout(() => {
        loadUser();
      }, 150);
    } else {
      // Hydrate session on mount to detect already logged-in users
      loadUser();
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Prevent double sign-in if user already authenticated
      if (user) {
        console.log("User already authenticated, skipping sign-in");
        return;
      }
      await signIn({ username: email, password });
      await loadUser();
    } catch (error: any) {
      // Handle case where user is already signed in
      if (error.name === "UserAlreadyAuthenticatedException") {
        console.log("User already authenticated, hydrating session");
        await loadUser();
      } else {
        throw error;
      }
    }
  };

  const signup = async (email: string, password: string) => {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const loginWithGoogle = async () => {
    try {
      // Prevent double sign-in if user already authenticated
      if (user) {
        console.log("User already authenticated, skipping Google sign-in");
        return;
      }
      await signInWithRedirect({
        provider: "Google",
        ...({
          extraQueryParams: {
            prompt: "select_account",
          },
        } as any),
      });
    } catch (error: any) {
      // Handle case where user is already signed in
      if (error.name === "UserAlreadyAuthenticatedException") {
        console.log("User already authenticated, hydrating session");
        await loadUser();
      } else {
        console.error("Google sign-in error:", error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        loginWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
