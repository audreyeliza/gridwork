"use client";

import { MakerHopperCard } from "@/components/machine/MakerHopperCard";
import { RotaryKnob } from "@/components/machine/RotaryKnob";
import { useNavAuth } from "@/components/NavAuthProvider";
import { fetchUserLikedPatterns, type GalleryPattern } from "@/lib/galleryHelpers";
import { parseManilaStockFromSettings } from "@/lib/manilaStock";
import { fetchPatternsForUser, type Pattern } from "@/lib/patternHelpers";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

type Props = {
  onProgramCard: (patternId: string | null) => void;
  onNewProgram: () => void;
  onPreviewCard: (pattern: GalleryPattern, makerLabel: string, isOwn: boolean) => void;
  previewId?: string | null;
  creating?: boolean;
};

function patternToGallery(p: Pattern): GalleryPattern {
  return {
    id: p.id,
    user_id: p.user_id,
    name: p.name,
    grid_width: p.grid_width,
    grid_height: p.grid_height,
    thumbnail: p.thumbnail ?? null,
    likes_count: p.likes_count ?? 0,
    copies_count: p.copies_count ?? 0,
    updated_at: p.updated_at,
    manila_stock: parseManilaStockFromSettings(p.image_settings),
    is_public: p.is_public ?? false,
  };
}

function formatEditedLabel(updatedAt: string, visibility?: "Public" | "Private") {
  let date = "";
  try {
    date = new Date(updatedAt).toLocaleDateString(undefined, { dateStyle: "short" });
  } catch {
    date = "";
  }
  const edited = date ? `Edited ${date}` : "Edited";
  return visibility ? `${visibility} · ${edited}` : edited;
}

export function MakerZone({ onProgramCard, onNewProgram, onPreviewCard, previewId = null, creating = false }: Props) {
  const { user, displayName, avatarUrl, signOut } = useNavAuth();
  const [tab, setTab] = useState<"mine" | "liked">("mine");
  const [mine, setMine] = useState<Pattern[]>([]);
  const [liked, setLiked] = useState<GalleryPattern[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }
    setLoading(true);
    const [{ data: patterns }, { data: likedPatterns }] = await Promise.all([
      fetchPatternsForUser(supabase, user.id),
      fetchUserLikedPatterns(supabase, user.id),
    ]);
    setMine(patterns ?? []);
    setLiked(likedPatterns ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-chassis-light uppercase">
          Deck
        </p>
        <p className="font-mono text-sm text-card">Log in on the keyboard to load your Deck.</p>
      </div>
    );
  }

  const makerTag = displayName ? `@${displayName}` : "You";
  const deckCount = tab === "mine" ? mine.length : liked.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="punch-console-face !flex-col !items-stretch !justify-between !gap-2">
        <span className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#0A0A0A" }}>
          Deck
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue font-mono text-sm font-bold text-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (displayName ?? user.email ?? "?").charAt(0).toUpperCase()
            )}
          </span>
          <h1 className="min-w-0 truncate font-mono text-[13px] font-bold tracking-[0.06em] uppercase" style={{ color: "#0A0A0A" }}>
            {makerTag}
          </h1>

          <div className="min-w-0 flex-1" />

          <RotaryKnob
            label="Deck"
            value={tab}
            options={[
              { value: "mine" as const, label: "Mine" },
              { value: "liked" as const, label: "Liked" },
            ]}
            onChange={setTab}
            accent="#0A0A0A"
            pointer="#FFFFFF"
            dial="var(--key-blue)"
          />

          <button
            type="button"
            onClick={onNewProgram}
            disabled={creating}
            className="punch-lamp punch-lamp-green !min-h-[32px] !px-2.5 text-[9px]"
            title="New pattern"
          >
            {creating ? "…" : "New"}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="punch-lamp punch-lamp-amber !min-h-[32px] !px-2.5 text-[9px]"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="punch-console-bay min-h-0 flex-1 overflow-y-auto">
        {!loading && (
          <p className="relative z-[2] mb-3 pl-2 font-mono text-[10px] font-medium tracking-[0.08em] uppercase" style={{ color: "#0A0A0A" }}>
            {deckCount === 0
              ? tab === "mine"
                ? "No cards yet. Hit New."
                : "No liked cards yet."
              : `${deckCount} pattern${deckCount === 1 ? "" : "s"}`}
          </p>
        )}
        {loading ? (
          <p className="py-16 text-center font-mono text-sm text-chassis-light">Loading…</p>
        ) : (tab === "mine" ? mine : liked).length === 0 ? null : (
          <div className="hopper-bay pl-6">
            <div className="relative z-[2] grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {tab === "mine"
                ? mine.map((p) => {
                    const g = patternToGallery(p);
                    return (
                      <MakerHopperCard
                        key={p.id}
                        name={p.name}
                        thumbnail={p.thumbnail}
                        gridWidth={p.grid_width}
                        gridHeight={p.grid_height}
                        statusLabel={formatEditedLabel(
                          p.updated_at,
                          p.is_public ? "Public" : "Private",
                        )}
                        likesCount={p.likes_count ?? 0}
                        copiesCount={p.copies_count ?? 0}
                        manilaStock={g.manila_stock}
                        active={previewId === p.id}
                        onClick={() => onPreviewCard(g, makerTag, true)}
                      />
                    );
                  })
                : liked.map((p) => (
                    <MakerHopperCard
                      key={p.id}
                      name={p.name}
                      thumbnail={p.thumbnail}
                      gridWidth={p.grid_width}
                      gridHeight={p.grid_height}
                      statusLabel={formatEditedLabel(p.updated_at)}
                      likesCount={p.likes_count}
                      copiesCount={p.copies_count}
                      manilaStock={p.manila_stock}
                      active={previewId === p.id}
                      onClick={() => onPreviewCard(p, `@${p.user_id.slice(0, 6)}`, false)}
                    />
                  ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
