"use client";

import type { User } from "@supabase/supabase-js";
import type { Pattern } from "@/lib/patternHelpers";
import { checkDisplayNameAvailable } from "@/lib/profileHelpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useRef, useState } from "react";

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

function validateDisplayName(name: string): string | null {
  if (name.length < 3) return "At least 3 characters";
  if (name.length > 30) return "30 characters maximum";
  if (!NAME_REGEX.test(name)) return "Letters, numbers, underscores only";
  return null;
}

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
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
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
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5l2.5 2.5-7 7H4v-2.5l7-7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  );
}

export function PatternSidebar({
  user,
  supabase,
  displayName,
  onSaveDisplayName,
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
  const inputRef = useRef<HTMLInputElement>(null);

  // Display name inline edit state
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [dnInput, setDnInput] = useState("");
  const [dnLocalError, setDnLocalError] = useState<string | null>(null);
  const [dnAvailability, setDnAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [dnSaving, setDnSaving] = useState(false);
  const dnDebounceRef = useRef<number | undefined>(undefined);
  const dnInputRef = useRef<HTMLInputElement>(null);

  const startEditDisplayName = useCallback(() => {
    setDnInput(displayName ?? "");
    setDnLocalError(null);
    setDnAvailability("idle");
    setEditingDisplayName(true);
    window.setTimeout(() => { dnInputRef.current?.select(); dnInputRef.current?.focus(); }, 0);
  }, [displayName]);

  const cancelEditDisplayName = useCallback(() => {
    if (dnDebounceRef.current !== undefined) window.clearTimeout(dnDebounceRef.current);
    setEditingDisplayName(false);
  }, []);

  const handleDnChange = useCallback(
    (value: string) => {
      setDnInput(value);
      const err = validateDisplayName(value);
      setDnLocalError(err);

      if (dnDebounceRef.current !== undefined) window.clearTimeout(dnDebounceRef.current);

      if (err || value.trim() === "") {
        setDnAvailability("idle");
        return;
      }

      setDnAvailability("checking");
      dnDebounceRef.current = window.setTimeout(() => {
        if (!supabase || !user) return;
        void checkDisplayNameAvailable(supabase, value, user.id).then((available) => {
          setDnAvailability(available ? "available" : "taken");
        });
      }, 500) as unknown as number;
    },
    [supabase, user],
  );

  const commitDisplayName = useCallback(async () => {
    if (dnLocalError || dnAvailability !== "available" || dnSaving || !onSaveDisplayName) return;
    setDnSaving(true);
    await onSaveDisplayName(dnInput.trim());
    setDnSaving(false);
    setEditingDisplayName(false);
  }, [dnLocalError, dnAvailability, dnSaving, dnInput, onSaveDisplayName]);

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

  if (!user) {
    return (
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand/15 bg-white/90 shadow-sm">
        <div className="border-b border-brand/15 px-4 py-3">
          <h1 className="text-sm font-semibold text-stone-800">Patterns</h1>
        </div>
        <div className="flex flex-1 flex-col items-stretch justify-center gap-3 p-4">
          <p className="text-center text-sm text-stone-600">
            Log in to view and save your patterns.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="cursor-pointer rounded-full bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
          >
            Log in
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-brand/15 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-brand/15 px-4 py-3">
        <h1 className="text-sm font-semibold text-stone-800">Patterns</h1>
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-accent-dark"
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
              <li key={p.id} className="group relative">
                {editingId === p.id ? (
                  <div className="rounded-xl px-3 py-2 ring-1 ring-brand/40 bg-brand/5 shadow-sm">
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
                      className="w-full bg-transparent text-sm font-medium text-stone-900 outline-none"
                    />
                    <span className="block text-xs font-normal text-stone-500">{formatUpdatedAt(p.updated_at)}</span>
                  </div>
                ) : (
                  <div className={`flex items-center rounded-xl transition-colors ${
                    selectedPatternId === p.id
                      ? "bg-brand/8 ring-1 ring-brand/20 shadow-sm"
                      : "hover:bg-stone-50"
                  } ${confirmDeleteId === p.id ? "ring-1 ring-rose-300 bg-rose-50/60" : ""}`}>
                    <button
                      type="button"
                      onClick={() => onSelectPattern(p.id)}
                      onDoubleClick={(e) => { e.stopPropagation(); startEdit(p); }}
                      className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                    >
                      <span className={`block truncate font-medium ${
                        selectedPatternId === p.id ? "text-stone-900" : "text-stone-700"
                      }`}>
                        {p.name}
                      </span>
                      <span className="block text-xs font-normal text-stone-500">
                        {p.is_public && (
                          <span className="mr-1 text-teal-600">Public ·</span>
                        )}
                        {formatUpdatedAt(p.updated_at)}
                      </span>
                    </button>
                    {onTogglePublic && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onTogglePublic(p.id, !(p.is_public ?? false)); }}
                        title={p.is_public ? "Make private" : "Make public"}
                        className="shrink-0 rounded-md p-1.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-stone-50 text-stone-400 hover:text-stone-600"
                      >
                        {p.is_public ? <GlobeIcon /> : <LockClosedIcon />}
                      </button>
                    )}
                    {onDeletePattern && (
                      <button
                        type="button"
                        onClick={(e) => confirmDelete(e, p.id)}
                        title="Delete pattern"
                        className="mr-1.5 shrink-0 rounded-md p-1.5 text-stone-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
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

      {/* User profile section */}
      {user && (
        <div className="shrink-0 border-t border-brand/10 px-4 py-3">
          {editingDisplayName ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-1">
                <input
                  ref={dnInputRef}
                  type="text"
                  value={dnInput}
                  onChange={(e) => handleDnChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void commitDisplayName();
                    if (e.key === "Escape") cancelEditDisplayName();
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (document.activeElement !== dnInputRef.current) cancelEditDisplayName();
                    }, 150);
                  }}
                  maxLength={30}
                  placeholder="display_name"
                  className="min-w-0 flex-1 rounded-lg border border-brand/30 bg-white px-2 py-1 text-xs text-stone-900 outline-none focus:ring-1 focus:ring-brand/30"
                />
                <button
                  type="button"
                  onClick={() => void commitDisplayName()}
                  disabled={dnLocalError !== null || dnAvailability !== "available" || dnSaving}
                  title="Save"
                  className="shrink-0 rounded-md p-1 text-teal-600 hover:bg-teal-50 disabled:opacity-40"
                >
                  <CheckIcon />
                </button>
              </div>
              <div className="mt-0.5 min-h-[14px] text-[10px]">
                {dnLocalError && dnInput !== "" && (
                  <span className="text-brand">{dnLocalError}</span>
                )}
                {!dnLocalError && dnAvailability === "checking" && (
                  <span className="text-stone-400">Checking…</span>
                )}
                {!dnLocalError && dnAvailability === "available" && (
                  <span className="text-teal-600">✓ available</span>
                )}
                {!dnLocalError && dnAvailability === "taken" && (
                  <span className="text-brand">✗ taken</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5">
              {displayName ? (
                <span className="text-xs font-medium text-stone-700">{displayName}</span>
              ) : (
                <span className="text-xs text-stone-400">No display name set</span>
              )}
              {onSaveDisplayName && (
                <button
                  type="button"
                  onClick={startEditDisplayName}
                  title="Edit display name"
                  className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                >
                  <PencilIcon />
                </button>
              )}
            </div>
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
