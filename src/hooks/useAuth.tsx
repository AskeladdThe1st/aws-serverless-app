import { createContext, useContext, useState, useEffect, ReactNode } from "react";

import { signIn, signUp, signOut, getCurrentUser, fetchUserAttributes, signInWithRedirect } from "aws-amplify/auth";

interface User {
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

  /** -------------------------------------------------------
   *  LOAD USER PROPERLY (THIS WAS YOUR MAIN PROBLEM)
   *  -------------------------------------------------------
   */
  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();

      // Extract properly (Cognito uses EXACT names below)
      const email = attributes.email ?? "";
      const name =
        attributes.name ||
        `${attributes.given_name || ""} ${attributes.family_name || ""}`.trim() ||
        email.split("@")[0];

      setUser({
        email,
        name,
        picture: attributes.picture,
        given_name: attributes.given_name,
        family_name: attributes.family_name,
        isPremium: email === DEVELOPER_EMAIL,
      });
    } catch (err) {
      console.log("No authenticated user:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /** -------------------------------------------------------
   *  HANDLE OAUTH REDIRECT PROPERLY
   *  -------------------------------------------------------
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // If this is an OAuth return, load user
    if (params.has("code") || params.has("state")) {
      setTimeout(() => {
        loadUser();
      }, 150); // small delay lets Amplify store the tokens correctly
    } else {
      // If page loads normally, try loading cached session
      loadUser();
    }
  }, []);

  /** Email/Password login */
  const login = async (email: string, password: string) => {
    await signIn({ username: email, password });
    await loadUser();
  };

  /** Email/Password signup */
  const signup = async (email: string, password: string) => {
    await signUp({
      username: email,
      password,
      options: { userAttributes: { email } },
    });
  };

  /** Logout */
  const logout = async () => {
    await signOut();
    setUser(null);
  };

  /** -------------------------------------------------------
   * GOOGLE LOGIN (CORRECT FIXED VERSION)
   * -------------------------------------------------------
   */
  const loginWithGoogle = async () => {
    await signInWithRedirect({
      provider: "Google",
      ...({
        extraQueryParams: {
          prompt: "select_account",
        },
      } as any),
    });
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

/** Hook */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
