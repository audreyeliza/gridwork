"use client";

import type { User } from "@supabase/supabase-js";
import type { Pattern } from "@/lib/patternHelpers";

export type PatternSidebarProps = {
  user: User | null;
  patterns: Pattern[];
  patternsLoading: boolean;
  selectedPatternId: string | null;
  onSelectPattern: (id: string) => void;
  onCreateNew: () => void;
  onOpenAuth: () => void;
};

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function PatternSidebar({
  user,
  patterns,
  patternsLoading,
  selectedPatternId,
  onSelectPattern,
  onCreateNew,
  onOpenAuth,
}: PatternSidebarProps) {
  if (!user) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Patterns</h1>
        </div>
        <div className="flex flex-1 flex-col items-stretch justify-center gap-3 p-4">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Log in to view and save your patterns.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Log in
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Patterns</h1>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {patternsLoading ? (
          <p className="px-2 py-4 text-center text-sm text-zinc-500">Loading…</p>
        ) : patterns.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-zinc-500">No patterns yet. Create one with New.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {patterns.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelectPattern(p.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedPatternId === p.id
                      ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-700"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  <span className="block truncate">{p.name}</span>
                  <span className="block text-xs font-normal text-zinc-500">{formatUpdatedAt(p.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
