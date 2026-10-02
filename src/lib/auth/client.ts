import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
export const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? "";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseUrl || !supabasePublishableKey) return null;
  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
    global: {
      headers: { "x-application-name": "movewisely" },
    },
  });
  return client;
}

export type AuthSnapshot = { session: Session | null; user: User | null };
