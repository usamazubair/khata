import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken, setUnauthorizedHandler, SERVER_URL, User } from "./api";

type AuthState = {
  ready: boolean;
  user: User | null;
  serverUrl: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  // Restore the saved session on launch: if the stored token still checks out
  // the app opens straight to the modules list, otherwise it shows login.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          setUser(await api.me());
        } catch {
          await clearToken();
        }
      }
      setReady(true);
    })();
  }, []);

  // Any 401 from anywhere in the app drops straight back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: signedIn } = await api.login(email, password);
    await setToken(token);
    setUser(signedIn);
  }, []);

  const value = useMemo(
    () => ({ ready, user, serverUrl: SERVER_URL, signIn, signOut }),
    [ready, user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
