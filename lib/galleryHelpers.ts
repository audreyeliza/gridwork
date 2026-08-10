import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseManilaStockFromSettings,
  type ManilaStockId,
} from "@/lib/manilaStock";

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
  manila_stock?: ManilaStockId;
  /** Present for own patterns in the private deck; gallery rows are always public. */
  is_public?: boolean;
};

const GALLERY_SELECT =
  "id, user_id, name, grid_width, grid_height, thumbnail, likes_count, copies_count, updated_at, image_settings";

function mapGalleryRow(row: Record<string, unknown>): GalleryPattern {
  const stock = parseManilaStockFromSettings(row.image_settings);
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    grid_width: row.grid_width as number,
    grid_height: row.grid_height as number,
    thumbnail: (row.thumbnail as string | null) ?? null,
    likes_count: (row.likes_count as number) ?? 0,
    copies_count: (row.copies_count as number) ?? 0,
    updated_at: row.updated_at as string,
    manila_stock: stock,
  };
}

export type GallerySortBy = "newest" | "popular" | "relevant";

export type FetchGalleryOptions = {
  sortBy?: GallerySortBy;
  search?: string;
  page?: number;
  pageSize?: number;
};

/** Lower = more relevant. Exact > prefix > contains; ties use updated_at desc. */
function relevanceRank(name: string, q: string): number {
  const n = name.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  return 2;
}

function sortByRelevance(patterns: GalleryPattern[], search: string): GalleryPattern[] {
  const q = search.trim().toLowerCase();
  if (!q) return patterns;
  return [...patterns].sort((a, b) => {
    const rankDiff = relevanceRank(a.name, q) - relevanceRank(b.name, q);
    if (rankDiff !== 0) return rankDiff;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function fetchGalleryPatterns(
  supabase: SupabaseClient,
  opts: FetchGalleryOptions = {},
): Promise<{ data: GalleryPattern[]; total: number; error: Error | null }> {
  const { sortBy = "newest", search = "", page = 0, pageSize = 24 } = opts;
  const trimmedSearch = search.trim();
  const useRelevant = sortBy === "relevant" && trimmedSearch.length > 0;

  let query = supabase
    .from("patterns")
    .select(GALLERY_SELECT, { count: "exact" })
    .eq("is_public", true);

  if (trimmedSearch) {
    query = query.ilike("name", `%${trimmedSearch}%`);
  }

  if (sortBy === "popular") {
    query = query
      .order("likes_count", { ascending: false })
      .order("updated_at", { ascending: false });
  } else {
    // newest, or relevant with empty query (falls back to newest)
    query = query.order("updated_at", { ascending: false });
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;

  let patterns = ((data as Record<string, unknown>[] | null) ?? []).map(mapGalleryRow);
  if (useRelevant) {
    patterns = sortByRelevance(patterns, trimmedSearch);
  }

  return {
    data: patterns,
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

export async function fetchUserLikedPatterns(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: GalleryPattern[]; error: Error | null }> {
  const { data: likedRows, error: likedError } = await supabase
    .from("pattern_likes")
    .select("pattern_id")
    .eq("user_id", userId);

  if (likedError) return { data: [], error: likedError as Error | null };
  if (!likedRows || likedRows.length === 0) return { data: [], error: null };

  const ids = (likedRows as { pattern_id: string }[]).map((r) => r.pattern_id);

  const { data, error } = await supabase
    .from("patterns")
    .select(GALLERY_SELECT)
    .in("id", ids)
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  return {
    data: ((data as Record<string, unknown>[] | null) ?? []).map(mapGalleryRow),
    error: error as Error | null,
  };
}

export async function fetchPublicPatternsByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: GalleryPattern[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .select(GALLERY_SELECT)
    .eq("is_public", true)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return {
    data: ((data as Record<string, unknown>[] | null) ?? []).map(mapGalleryRow),
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
