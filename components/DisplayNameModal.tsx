"use client";

import { checkDisplayNameAvailable, upsertProfile } from "@/lib/profileHelpers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;

function validateLocal(name: string): string | null {
  if (name.length < 3) return "At least 3 characters required";
  if (name.length > 30) return "30 characters maximum";
  if (!NAME_REGEX.test(name)) return "Letters, numbers, and underscores only";
  return null;
}

export type DisplayNameModalProps = {
  open: boolean;
  userId: string;
  supabase: SupabaseClient;
  onSaved: (displayName: string) => void;
  onSkip: () => void;
  /** Optional warning message shown in pink, e.g. when triggered by making a pattern public. */
  message?: string;
};

export function DisplayNameModal({
  open,
  userId,
  supabase,
  onSaved,
  onSkip,
  message,
}: DisplayNameModalProps) {
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setLocalError(null);
      setAvailability("idle");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleChange = useCallback(
    (value: string) => {
      setName(value);
      const err = validateLocal(value);
      setLocalError(err);

      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);

      if (err || value.trim() === "") {
        setAvailability("idle");
        return;
      }

      setAvailability("checking");
      debounceRef.current = window.setTimeout(() => {
        void checkDisplayNameAvailable(supabase, value, userId).then((available) => {
          setAvailability(available ? "available" : "taken");
        });
      }, 500) as unknown as number;
    },
    [supabase, userId],
  );

  const handleSave = useCallback(async () => {
    if (localError || availability !== "available" || saving) return;
    setSaving(true);
    const { error } = await upsertProfile(supabase, userId, name.trim());
    setSaving(false);
    if (error) {
      console.error(error);
      return;
    }
    onSaved(name.trim());
  }, [supabase, userId, name, localError, availability, saving, onSaved]);

  if (!open) return null;

  const canSave = !localError && availability === "available" && name.trim() !== "" && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-brand/20 bg-white p-6 shadow-2xl">
        <h2 className="font-serif text-lg font-bold text-stone-900">Set your display name</h2>

        {message ? (
          <p className="mt-1.5 text-sm text-brand">{message}</p>
        ) : (
          <p className="mt-1.5 text-sm text-stone-500">
            This is how you appear on public patterns. You can change it later.
          </p>
        )}

        <div className="mt-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) void handleSave();
            }}
            placeholder="your_username"
            maxLength={30}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/30"
          />

          <div className="mt-1.5 min-h-[18px] text-xs">
            {localError && name !== "" && (
              <span className="text-brand">{localError}</span>
            )}
            {!localError && availability === "checking" && (
              <span className="text-stone-400">Checking…</span>
            )}
            {!localError && availability === "available" && (
              <span className="text-teal-600">✓ available</span>
            )}
            {!localError && availability === "taken" && (
              <span className="text-brand">✗ taken</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-40"
          >
            {saving ? "Saving…" : "Set name"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-center text-xs text-stone-400 hover:text-stone-600"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
