import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { clearToken, get, getToken, login as apiLogin, setToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

type AuthValue = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Any 401 anywhere drops straight back to the login screen.
  useEffect(() => setUnauthorizedHandler(() => setUser(null)), []);

  // Restore the stored session on load; a stale token just falls through.
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setUser(await get<User>("/api/auth/me"));
        } catch {
          clearToken();
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: signedIn } = await apiLogin(email, password);
    setToken(token);
    setUser(signedIn);
  }, []);

  const value = useMemo(
    () => ({ ready, user, signIn, signOut, isAdmin: user?.role === "admin" }),
    [ready, user, signIn, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
