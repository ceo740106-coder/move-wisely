import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./client";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  finishPasswordRecovery: () => void;
};

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let alive = true;
    client.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      if (alive) setLoading(false);
    });

    const { data } = client.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setPasswordRecovery(event === "PASSWORD_RECOVERY");
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthValue>(() => ({
    session,
    user,
    loading,
    configured: Boolean(client),
    passwordRecovery,
    signIn: async (email, password) => {
      if (!client) return { error: "Supabase is not configured yet." };
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      if (!client) return { error: "Supabase is not configured yet.", needsConfirmation: false };
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
      return { error: error?.message ?? null, needsConfirmation: !data.session && !error };
    },
    signOut: async () => {
      if (!client) return { error: null };
      const { error } = await client.auth.signOut({ scope: "local" });
      setPasswordRecovery(false);
      return { error: error?.message ?? null };
    },
    resetPassword: async (email) => {
      if (!client) return { error: "Supabase is not configured yet." };
      const redirectTo = `${window.location.origin}/?reset=1`;
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      return { error: error?.message ?? null };
    },
    updatePassword: async (password) => {
      if (!client) return { error: "Supabase is not configured yet." };
      const { error } = await client.auth.updateUser({ password });
      if (!error) setPasswordRecovery(false);
      return { error: error?.message ?? null };
    },
    finishPasswordRecovery: () => setPasswordRecovery(false),
  }), [client, loading, passwordRecovery, session, user]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
