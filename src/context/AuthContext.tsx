import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/config/firebase";
const AuthContext = createContext<{ user: User | null; initializing: boolean; error: string | null; logout: () => Promise<void> } | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, next => { setUser(next); setInitializing(false); setError(null); }, () => { setError("Could not check your login. Refresh the page to try again."); setInitializing(false); }), []);
  return <AuthContext.Provider value={{ user, initializing, error, logout: () => signOut(auth) }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
