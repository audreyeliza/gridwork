import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptyGrid, DEFAULT_PALETTE, serializeGridCells } from "@/lib/gridFormat";
import { defaultProgressState, serializeProgressData } from "@/lib/progressData";
import { DEFAULT_PATTERN_YARN_SETTINGS, serializePatternYarnSettings } from "@/lib/yarnSettings";
import { DEFAULT_PATTERN_IMAGE_DOCUMENT, serializeImageDocument } from "@/lib/imageSettings";
import { DEFAULT_MANILA_STOCK } from "@/lib/manilaStock";

/** JSON column values from Postgres (matches typical Supabase typing). */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Pattern = {
  id: string;
  user_id: string;
  name: string;
  grid_data: Json;
  grid_width: number;
  grid_height: number;
  progress_data: Json;
  yarn_settings: Json;
  image_settings?: Json;
  is_public?: boolean;
  thumbnail?: string | null;
  likes_count?: number;
  copies_count?: number;
  updated_at: string;
};

export type PatternInsert = Omit<Pattern, "id" | "updated_at" | "likes_count" | "copies_count"> & {
  id?: string;
  updated_at?: string;
};

export type PatternUpsert = PatternInsert;

export async function fetchPatternsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: Pattern[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return { data: data as Pattern[] | null, error: error as Error | null };
}

export async function fetchPatternById(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<{ data: Pattern | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  return { data: data as Pattern | null, error: error as Error | null };
}

export async function upsertPattern(
  supabase: SupabaseClient,
  row: PatternUpsert,
): Promise<{ data: Pattern | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("patterns")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  return { data: data as Pattern | null, error: error as Error | null };
}

export async function deletePattern(
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("patterns")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return { error: error as Error | null };
}

/** Create a blank Untitled 10×40 pattern for the given user. */
export async function createUntitledPattern(
  supabase: SupabaseClient,
  userId: string,
  extras?: Partial<Pick<PatternUpsert, "image_settings" | "yarn_settings" | "progress_data" | "name">>,
): Promise<{ data: Pattern | null; error: Error | null }> {
  return upsertPattern(supabase, {
    user_id: userId,
    name: extras?.name ?? "Untitled",
    grid_data: serializeGridCells(createEmptyGrid(10, 40), DEFAULT_PALETTE),
    grid_width: 10,
    grid_height: 40,
    progress_data: extras?.progress_data ?? serializeProgressData(defaultProgressState(40, 10)),
    yarn_settings: extras?.yarn_settings ?? serializePatternYarnSettings(DEFAULT_PATTERN_YARN_SETTINGS),
    image_settings:
      extras?.image_settings ??
      serializeImageDocument(DEFAULT_PATTERN_IMAGE_DOCUMENT, { manila_stock: DEFAULT_MANILA_STOCK }),
  });
}
