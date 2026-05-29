"use client";

import type { User } from "@supabase/supabase-js";
import type { Pattern } from "@/lib/patternHelpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRef, useState } from "react";

export type PatternSidebarProps = {
  user: User | null;
  supabase?: SupabaseClient | null;
  displayName?: string | null;
  onSaveDisplayName?: (name: string) => Promise<void>;
  patterns: Pattern[];
  patternsLoading: boolean;
  selectedPatternId: string | null;
  onSelectPattern: (id: string) => void;
  onCreateNew: () => void;
  onOpenAuth: () => void;
  onRenamePattern?: (id: string, newName: string) => void;
  onDeletePattern?: (id: string) => Promise<void>;
  onTogglePublic?: (id: string, isPublic: boolean) => void;
};

function formatUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (dDay.getTime() === today.getTime()) {
      const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return `Saved · today, ${t}`;
    }
    if (dDay.getTime() === yesterday.getTime()) {
      return "Saved · yesterday";
    }
    return `Saved · ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return "Saved";
  }
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5 4l.75 8.5h4.5L11 4" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5a8 8 0 010 11M8 2.5a8 8 0 000 11" />
    </svg>
  );
}

function LockClosedIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 016 0v2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2l2 2-7 7-2.5.5.5-2.5 7-7z" />
    </svg>
  );
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
  onDeletePattern,
  onTogglePublic,
}: PatternSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (p: Pattern) => {
    setEditingId(p.id);
    setEditingName(p.name);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editingId && onRenamePattern) {
      const trimmed = editingName.trim();
      if (trimmed) onRenamePattern(editingId, trimmed);
    }
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId || !onDeletePattern) return;
    setDeleting(true);
    await onDeletePattern(confirmDeleteId);
    setDeleting(false);
    setConfirmDeleteId(null);
  };

  const confirmingPattern = patterns.find((p) => p.id === confirmDeleteId);

  const filteredPatterns = searchQuery
    ? patterns.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : patterns;

  return (
    <aside
      className="flex h-full shrink-0 flex-col bg-[#FBF7EF]"
      style={{ width: 244, borderRight: "1px solid rgba(61,42,30,0.10)" }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between"
        style={{ padding: "18px 18px 14px", borderBottom: "1px solid rgba(61,42,30,0.10)" }}
      >
        <div>
          <div
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted"
            style={{ marginBottom: 2 }}
          >
            Your library
          </div>
          <div className="font-serif text-[18px] font-bold tracking-[-0.01em] text-text-strong">
            Patterns
          </div>
        </div>
        {user && (
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center rounded-full bg-brand font-sans text-[12px] font-bold text-[#FBF7EF] hover:bg-brand-dark"
            style={{ padding: "6px 10px", boxShadow: "0 4px 14px rgba(168,70,111,0.30)" }}
          >
            + New
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search patterns…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-full border border-[rgba(61,42,30,0.12)] bg-white px-3.5 py-2 font-sans text-[13px] font-medium text-text-strong shadow-[0_2px_8px_rgba(40,20,30,0.08)] placeholder:text-muted focus:border-brand/35 focus:outline-none focus:ring-2 focus:ring-brand/15"
        />
      </div>

      {/* Content */}
      {!user ? (
        <div className="flex flex-1 flex-col items-stretch justify-center gap-3 p-4">
          <p className="text-center font-sans text-[13px] text-muted">
            Log in to view and save your patterns.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-full bg-brand px-3 py-2 font-sans text-sm font-bold text-[#FBF7EF] shadow-sm hover:bg-brand-dark"
          >
            Log in
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ padding: "4px 8px 14px" }}>
          {patternsLoading ? (
            <p className="px-2 py-4 text-center font-sans text-[13px] text-muted">Loading…</p>
          ) : filteredPatterns.length === 0 ? (
            <p className="px-2 py-4 text-center font-sans text-[13px] text-muted">
              {searchQuery ? "No patterns match." : "No patterns yet. Create one with New."}
            </p>
          ) : (
            <ul className="flex flex-col" style={{ gap: 2 }}>
              {filteredPatterns.map((p) => (
                <li key={p.id} className="group relative">
                  {editingId === p.id ? (
                    <div
                      className="rounded-[10px]"
                      style={{
                        padding: "9px 12px",
                        background: "rgba(168,70,111,0.10)",
                        border: "1px solid rgba(168,70,111,0.30)",
                      }}
                    >
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
                        className="w-full bg-transparent font-serif text-[15px] font-semibold text-text-strong outline-none"
                      />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center rounded-[10px] transition-colors ${
                        confirmDeleteId === p.id ? "ring-1 ring-rose-300 bg-rose-50/60" : ""
                      }`}
                      style={{
                        padding: "9px 12px",
                        background:
                          confirmDeleteId !== p.id && selectedPatternId === p.id
                            ? "rgba(168,70,111,0.10)"
                            : undefined,
                        border:
                          selectedPatternId === p.id && confirmDeleteId !== p.id
                            ? "1px solid rgba(168,70,111,0.30)"
                            : "1px solid transparent",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPattern(p.id)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startEdit(p);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-serif text-[15px] font-semibold text-text-strong">
                          {p.name}
                        </span>
                        <span
                          className="mt-0.5 block font-mono text-[10px] font-medium"
                          style={{ color: "#7A6A5F" }}
                        >
                          {p.is_public && (
                            <span className="font-bold text-brand">Public · </span>
                          )}
                          {formatUpdatedAt(p.updated_at)}
                        </span>
                      </button>
                      {onRenamePattern && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                          title="Rename pattern"
                          className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-all hover:text-brand group-hover:opacity-100"
                        >
                          <PencilIcon />
                        </button>
                      )}
                      {onTogglePublic && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePublic(p.id, !(p.is_public ?? false));
                          }}
                          title={p.is_public ? "Make private" : "Make public"}
                          className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-all hover:text-text-strong group-hover:opacity-100"
                        >
                          {p.is_public ? <GlobeIcon /> : <LockClosedIcon />}
                        </button>
                      )}
                      {onDeletePattern && (
                        <button
                          type="button"
                          onClick={(e) => confirmDelete(e, p.id)}
                          title="Delete pattern"
                          className="mr-1.5 shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { if (!deleting) setConfirmDeleteId(null); }}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-rose-100 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <TrashIcon />
              </span>
              <h2 className="text-sm font-semibold text-stone-900">Delete pattern?</h2>
            </div>
            <p className="mb-1 mt-3 truncate text-sm font-medium text-stone-800">
              &ldquo;{confirmingPattern?.name ?? "this pattern"}&rdquo;
            </p>
            <p className="mb-5 text-xs leading-snug text-stone-500">
              This action is permanent and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex-1 rounded-full bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
