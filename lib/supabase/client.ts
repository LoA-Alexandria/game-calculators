import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;
let publicClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  browserClient = url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { persistSession: true, detectSessionInUrl: true },
      })
    : null;

  return browserClient;
}

/** Anonymous-only client for public data that must stay under anon RLS policies. */
export function getSupabasePublicClient() {
  if (publicClient !== undefined) return publicClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  publicClient = url && publishableKey
    ? createClient(url, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

  return publicClient;
}
