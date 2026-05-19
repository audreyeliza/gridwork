import type { SupabaseClient } from "@supabase/supabase-js";

// Required Supabase table:
// create table public.profiles (
//   user_id uuid primary key references auth.users(id) on delete cascade,
//   display_name text not null,
//   created_at timestamptz not null default now(),
//   updated_at timestamptz not null default now()
// );
// create unique index profiles_display_name_lower_idx on profiles (lower(display_name));
// alter table public.profiles enable row level security;
// create policy "Public read" on public.profiles for select using (true);
// create policy "Own write" on public.profiles for all using (auth.uid() = user_id);

export type UserProfile = {
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: UserProfile | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data as UserProfile | null, error: error as Error | null };
}

export async function upsertProfile(
  supabase: SupabaseClient,
  userId: string,
  displayName: string,
): Promise<{ data: UserProfile | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, display_name: displayName, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  return { data: data as UserProfile | null, error: error as Error | null };
}

/** Returns true if the name is available. Excludes currentUserId so users can re-save their own name. */
export async function checkDisplayNameAvailable(
  supabase: SupabaseClient,
  displayName: string,
  currentUserId?: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("display_name", displayName)
    .maybeSingle();
  if (!data) return true;
  if (currentUserId && (data as { user_id: string }).user_id === currentUserId) return true;
  return false;
}

export async function fetchProfileByDisplayName(
  supabase: SupabaseClient,
  displayName: string,
): Promise<{ data: UserProfile | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("display_name", displayName)
    .maybeSingle();
  return { data: data as UserProfile | null, error: error as Error | null };
}

/** Batch-fetch display names keyed by user_id. */
export async function fetchProfilesByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { user_id: string; display_name: string }[]) {
    map.set(row.user_id, row.display_name);
  }
  return map;
}
