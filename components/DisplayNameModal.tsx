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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-recess/70 p-4">
      <div
        className="w-full max-w-sm border-2 border-chassis-dark bg-card p-6"
        style={{ clipPath: "polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)" }}
      >
        <h2 className="font-mono text-lg font-bold tracking-[0.04em] text-ink uppercase">Set your display name</h2>

        {message ? (
          <p className="mt-1.5 font-mono text-sm text-key-blue">{message}</p>
        ) : (
          <p className="mt-1.5 font-mono text-sm text-muted">
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
            className="w-full border border-chassis-dark bg-paper px-3 py-2.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-key-blue"
          />

          <div className="mt-1.5 min-h-[18px] font-mono text-xs">
            {localError && name !== "" && (
              <span className="text-key-blue">{localError}</span>
            )}
            {!localError && availability === "checking" && (
              <span className="text-muted">Checking…</span>
            )}
            {!localError && availability === "available" && (
              <span className="text-teal-700">✓ available</span>
            )}
            {!localError && availability === "taken" && (
              <span className="text-key-blue">✗ taken</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="punch-key punch-key-blue w-full min-h-[44px] disabled:opacity-40"
          >
            {saving ? "Saving…" : "Set name"}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="punch-key w-full"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
