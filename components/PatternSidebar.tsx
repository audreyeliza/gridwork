"use client";

import type { User } from "@supabase/supabase-js";
import type { Pattern } from "@/lib/patternHelpers";
import { useRef, useState } from "react";

export type PatternSidebarProps = {
  user: User | null;
  patterns: Pattern[];
  patternsLoading: boolean;
  selectedPatternId: string | null;
  onSelectPattern: (id: string) => void;
  onCreateNew: () => void;
  onOpenAuth: () => void;
  onRenamePattern?: (id: string, newName: string) => void;
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
  onRenamePattern,
}: PatternSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (p: Pattern) => {
    setEditingId(p.id);
    setEditingName(p.name);
    // Focus after render
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editingId && onRenamePattern) {
      const trimmed = editingName.trim();
      if (trimmed) onRenamePattern(editingId, trimmed);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  if (!user) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-rose-100/80 bg-white/90 shadow-sm">
        <div className="border-b border-rose-100/80 px-4 py-3">
          <h1 className="text-sm font-semibold text-rose-900">Patterns</h1>
        </div>
        <div className="flex flex-1 flex-col items-stretch justify-center gap-3 p-4">
          <p className="text-center text-sm text-stone-600">
            Log in to view and save your patterns.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="cursor-pointer rounded-full bg-rose-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-600"
          >
            Log in
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-rose-100/80 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-rose-100/80 px-4 py-3">
        <h1 className="text-sm font-semibold text-rose-900">Patterns</h1>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-full bg-violet-500 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-violet-600"
        >
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {patternsLoading ? (
          <p className="px-2 py-4 text-center text-sm text-stone-500">Loading…</p>
        ) : patterns.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-stone-500">No patterns yet. Create one with New.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {patterns.map((p) => (
              <li key={p.id}>
                {editingId === p.id ? (
                  <div className="rounded-xl px-3 py-2 ring-1 ring-rose-300 bg-rose-50 shadow-sm">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                      onBlur={commitEdit}
                      className="w-full bg-transparent text-sm font-medium text-rose-950 outline-none"
                    />
                    <span className="block text-xs font-normal text-stone-500">{formatUpdatedAt(p.updated_at)}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectPattern(p.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      startEdit(p);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      selectedPatternId === p.id
                        ? "bg-rose-50 font-medium text-rose-950 shadow-sm ring-1 ring-rose-100"
                        : "text-stone-700 hover:bg-amber-50/60"
                    }`}
                  >
                    <span className="block truncate">{p.name}</span>
                    <span className="block text-xs font-normal text-stone-500">{formatUpdatedAt(p.updated_at)}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
