"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import { checkDisplayNameAvailable, upsertProfile } from "@/lib/profileHelpers";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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
  /** Optional warning message shown when triggered by making a pattern public. */
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
  const titleId = useId();
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onSkip]);

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
      Sentry.captureException(error);
      return;
    }
    onSaved(name.trim());
  }, [supabase, userId, name, localError, availability, saving, onSaved]);

  if (!open) return null;

  const canSave = !localError && availability === "available" && name.trim() !== "" && !saving;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-recess/70"
        aria-label="Close dialog"
        onClick={onSkip}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(e) => e.stopPropagation()}
        className="punch-card relative z-10 flex min-h-[26rem] w-full max-w-sm flex-col px-6 py-5"
        style={{ ["--manila-stock" as string]: "#E8E2D0" }}
      >
        <OperatorCardHeader title="Display name card" colLabel="JOB NAME">
          <h2 id={titleId} className="sr-only">
            Set your display name
          </h2>
        </OperatorCardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void handleSave();
          }}
          className="mt-4 flex min-h-0 flex-1 flex-col gap-3"
        >
          <div>
            <label
              htmlFor="display-name"
              className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
            >
              Display name
            </label>
            <input
              ref={inputRef}
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="your_username"
              maxLength={30}
              autoComplete="username"
              className="punch-print-field"
            />
            <div className="mt-1.5 min-h-[18px] font-mono text-[10px]">
              {message && !localError && availability === "idle" && name === "" ? (
                <span className="text-[var(--print-ink)]">{message}</span>
              ) : null}
              {localError && name !== "" ? (
                <span className="text-[var(--print-ink)]">{localError}</span>
              ) : null}
              {!localError && availability === "checking" ? (
                <span className="text-[var(--print-ink-faint)]">Checking…</span>
              ) : null}
              {!localError && availability === "available" ? (
                <span className="text-[var(--print-ink)]">Available</span>
              ) : null}
              {!localError && availability === "taken" ? (
                <span className="text-[var(--print-ink)]">Taken</span>
              ) : null}
              {!message && !localError && availability === "idle" && name === "" ? (
                <span className="text-[var(--print-ink-faint)]">
                  How you appear on public patterns
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <button
              type="submit"
              disabled={!canSave}
              className="punch-print text-[12px] tracking-[0.1em] disabled:opacity-40"
            >
              {saving ? "Saving…" : "Set name →"}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="punch-print text-[11px] opacity-70"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
