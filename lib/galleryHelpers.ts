import type { SupabaseClient } from "@supabase/supabase-js";

export type GalleryPattern = {
  id: string;
  user_id: string;
  name: string;
  grid_width: number;
  grid_height: number;
  thumbnail: string | null;
  likes_count: number;
  copies_count: number;
  updated_at: string;
};

export type GallerySortBy = "newest" | "popular";

export type FetchGalleryOptions = {
  sortBy?: GallerySortBy;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchGalleryPatterns(
  supabase: SupabaseClient,
  opts: FetchGalleryOptions = {},
): Promise<{ data: GalleryPattern[]; total: number; error: Error | null }> {
  const { sortBy = "newest", search = "", page = 0, pageSize = 24 } = opts;

  let query = supabase
    .from("patterns")
    .select(
      "id, user_id, name, grid_width, grid_height, thumbnail, likes_count, copies_count, updated_at",
      { count: "exact" },
    )
    .eq("is_public", true);

  if (search.trim()) {
    query = query.ilike("name", `%${search.trim()}%`);
  }

  if (sortBy === "popular") {
    query = query
      .order("likes_count", { ascending: false })
      .order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;

  return {
    data: (data as GalleryPattern[] | null) ?? [],
    total: count ?? 0,
    error: error as Error | null,
  };
}

export async function fetchUserLikedPatternIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("pattern_likes")
    .select("pattern_id")
    .eq("user_id", userId);

  return new Set(
    ((data ?? []) as { pattern_id: string }[]).map((row) => row.pattern_id),
  );
}

export async function togglePatternLike(
  supabase: SupabaseClient,
  patternId: string,
): Promise<{ nowLiked: boolean; error: Error | null }> {
  const { data, error } = await supabase.rpc("toggle_pattern_like", {
    p_pattern_id: patternId,
  });
  return { nowLiked: Boolean(data), error: error as Error | null };
}

export async function copyPublicPattern(
  supabase: SupabaseClient,
  patternId: string,
): Promise<{ newPatternId: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc("copy_public_pattern", {
    p_pattern_id: patternId,
  });
  return { newPatternId: data as string | null, error: error as Error | null };
}

export type UserSearchResult = {
  display_name: string;
  public_pattern_count: number;
};

export async function searchUsers(
  supabase: SupabaseClient,
  query: string,
): Promise<UserSearchResult[]> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .ilike("display_name", `%${query.trim()}%`)
    .limit(3);

  if (!profiles || profiles.length === 0) return [];

  const rows = profiles as { user_id: string; display_name: string }[];
  const userIds = rows.map((p) => p.user_id);

  const { data: patternRows } = await supabase
    .from("patterns")
    .select("user_id")
    .eq("is_public", true)
    .in("user_id", userIds);

  const countByUserId = new Map<string, number>();
  for (const row of (patternRows ?? []) as { user_id: string }[]) {
    countByUserId.set(row.user_id, (countByUserId.get(row.user_id) ?? 0) + 1);
  }

  return rows.map((p) => ({
    display_name: p.display_name,
    public_pattern_count: countByUserId.get(p.user_id) ?? 0,
  }));
}

export async function fetchPublicPatternsByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: GalleryPattern[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .select(
      "id, user_id, name, grid_width, grid_height, thumbnail, likes_count, copies_count, updated_at",
    )
    .eq("is_public", true)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return {
    data: (data as GalleryPattern[] | null) ?? [],
    error: error as Error | null,
  };
}

export async function setPatternPublic(
  supabase: SupabaseClient,
  patternId: string,
  userId: string,
  isPublic: boolean,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("patterns")
    .update({ is_public: isPublic })
    .eq("id", patternId)
    .eq("user_id", userId);
  return { error: error as Error | null };
}
