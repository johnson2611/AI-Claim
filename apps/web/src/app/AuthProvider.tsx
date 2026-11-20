import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from "firebase/auth";
import type { Role } from "@claims/shared";
import { api } from "../lib/api/client";
import { auth } from "../lib/firebase/app";

interface AuthState {
  ready: boolean;
  signedIn: boolean;
  role: Role | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        setSignedIn(!!user);
        if (!user) {
          setRole(null);
          setReady(true);
          return;
        }
        try {
          // The role is read from the server. The UI uses it only to choose what to show.
          const me = await api<{ role: Role }>("/api/me");
          setRole(me.role);
        } catch {
          setRole(null);
        }
        setReady(true);
      }),
    [],
  );

  const value: AuthState = {
    ready,
    signedIn,
    role,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOut: () => fbSignOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
