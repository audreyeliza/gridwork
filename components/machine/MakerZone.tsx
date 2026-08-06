"use client";

import { FlipSwitch } from "@/components/machine/FlipSwitch";
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
  onPreviewCard: (pattern: GalleryPattern, makerLabel: string, isOwn: boolean) => void;
  previewId?: string | null;
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
  };
}

export function MakerZone({ onProgramCard, onPreviewCard, previewId = null }: Props) {
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
          Maker station
        </p>
        <p className="font-mono text-sm text-card">Log in on the keyboard bar to load your cards.</p>
      </div>
    );
  }

  const makerTag = displayName ? `@${displayName}` : "You";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="punch-console-face !items-center !gap-4">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue font-mono text-sm font-bold text-white"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (displayName ?? user.email ?? "?").charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0 shrink-0">
          <p className="truncate font-mono text-[13px] font-bold tracking-[0.06em] text-card uppercase">
            {makerTag}
          </p>
          <p className="font-mono text-[10px] text-chassis-light uppercase">
            {mine.length} cards · {liked.length} liked
          </p>
        </div>

        <div className="min-w-0 flex-1" />

        <FlipSwitch
          label="New"
          on={false}
          onClick={() => onProgramCard(null)}
          title="New pattern"
        />

        <RotaryKnob
          label="Deck"
          value={tab}
          options={[
            { value: "mine" as const, label: "Mine" },
            { value: "liked" as const, label: "Liked" },
          ]}
          onChange={setTab}
          accent="#1A1A1A"
        />

        <button
          type="button"
          onClick={() => void signOut()}
          className="font-mono text-[10px] font-bold tracking-[0.12em] text-chassis-light uppercase transition-colors hover:text-card"
        >
          Log out
        </button>
      </div>

      <div className="punch-console-bay min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="py-16 text-center font-mono text-sm text-chassis-light">Loading…</p>
        ) : (tab === "mine" ? mine : liked).length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-chassis-light">
            {tab === "mine" ? "No cards yet. Hit NEW." : "No liked cards yet."}
          </p>
        ) : (
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
                        meta={`${p.is_public ? "Public" : "Private"} · ${p.grid_width}×${p.grid_height}`}
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
