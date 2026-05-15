import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/** Clears the singleton so the next `getSupabaseBrowserClient()` creates a fresh client (e.g. after a failed init retry). */
export function resetSupabaseBrowserClient(): void {
  browserClient = null;
}

/**
 * Browser Supabase client (NEXT_PUBLIC_* env). Safe to use from client components.
 * Throws if env vars are missing so misconfiguration fails fast.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  // Must use dot notation so Turbopack/Webpack inlines the values at bundle time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and set your Supabase project URL and anon key.");
  if (!anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and set your Supabase project URL and anon key.");
  return createClient(url, anonKey);
}

/** Singleton for client-side usage to avoid multiple GoTrue instances. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient();
  }
  return browserClient;
}
