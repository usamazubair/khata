import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getServerUrl, getToken, setServerUrl, setToken, setUnauthorizedHandler, User } from "./api";

type AuthState = {
  ready: boolean;
  user: User | null;
  serverUrl: string;
  signIn: (url: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setUrl] = useState("");

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  // Restore the saved session on launch: if the stored token still checks out
  // the app opens straight to the modules list, otherwise it shows login.
  useEffect(() => {
    (async () => {
      const [url, token] = await Promise.all([getServerUrl(), getToken()]);
      setUrl(url);
      if (url && token) {
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

  const signIn = useCallback(async (url: string, email: string, password: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, "");
    const { token, user: signedIn } = await api.login(cleanUrl, email, password);
    await setServerUrl(cleanUrl);
    await setToken(token);
    setUrl(cleanUrl);
    setUser(signedIn);
  }, []);

  const value = useMemo(
    () => ({ ready, user, serverUrl, signIn, signOut }),
    [ready, user, serverUrl, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
