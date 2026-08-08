"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import {
  checkDisplayNameAvailable,
  upsertProfile,
  upsertProfileAvatar,
} from "@/lib/profileHelpers";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const AVATAR_MAX_DIM = 256;
const AVATAR_QUALITY = 0.85;

function validateLocal(name: string): string | null {
  if (name.length < 3) return "At least 3 characters required";
  if (name.length > 30) return "30 characters maximum";
  if (!NAME_REGEX.test(name)) return "Letters, numbers, and underscores only";
  return null;
}

async function compressAvatarFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = Math.max(0, Math.floor((bitmap.width - size) / 2));
  const sy = Math.max(0, Math.floor((bitmap.height - size) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_MAX_DIM;
  canvas.height = AVATAR_MAX_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare avatar");
  }
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_MAX_DIM, AVATAR_MAX_DIM);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", AVATAR_QUALITY);
}

export type ProfileEditModalProps = {
  open: boolean;
  userId: string;
  supabase: SupabaseClient;
  currentDisplayName: string | null;
  currentAvatarUrl: string | null;
  onSaved: (displayName: string, avatarUrl: string | null) => void;
  onClose: () => void;
};

export function ProfileEditModal({
  open,
  userId,
  supabase,
  currentDisplayName,
  currentAvatarUrl,
  onSaved,
  onClose,
}: ProfileEditModalProps) {
  const titleId = useId();
  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">(
    "idle",
  );
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial = currentDisplayName ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets modal state each time it opens
    setName(initial);
    setAvatarPreview(currentAvatarUrl);
    setLocalError(initial ? validateLocal(initial) : null);
    setAvatarError(null);
    setAvailability(initial && !validateLocal(initial) ? "available" : "idle");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, currentDisplayName, currentAvatarUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

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

      if (currentDisplayName && value.trim().toLowerCase() === currentDisplayName.toLowerCase()) {
        setAvailability("available");
        return;
      }

      setAvailability("checking");
      debounceRef.current = window.setTimeout(() => {
        void checkDisplayNameAvailable(supabase, value, userId).then((available) => {
          setAvailability(available ? "available" : "taken");
        });
      }, 500) as unknown as number;
    },
    [supabase, userId, currentDisplayName],
  );

  const handleAvatarPick = useCallback(async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file");
      return;
    }
    setAvatarError(null);
    try {
      const dataUrl = await compressAvatarFile(file);
      setAvatarPreview(dataUrl);
    } catch (err) {
      console.error(err);
      Sentry.captureException(err);
      setAvatarError("Could not read that image");
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (localError || availability !== "available" || saving) return;
    const trimmed = name.trim();
    setSaving(true);
    const { error: nameError } = await upsertProfile(supabase, userId, trimmed);
    if (nameError) {
      console.error(nameError);
      Sentry.captureException(nameError);
      setSaving(false);
      return;
    }
    if (avatarPreview !== currentAvatarUrl) {
      const { error: avatarErr } = await upsertProfileAvatar(supabase, userId, avatarPreview);
      if (avatarErr) {
        console.error(avatarErr);
        Sentry.captureException(avatarErr);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onSaved(trimmed, avatarPreview);
  }, [
    localError,
    availability,
    saving,
    name,
    supabase,
    userId,
    avatarPreview,
    currentAvatarUrl,
    onSaved,
  ]);

  if (!open) return null;

  const canSave =
    !localError &&
    availability === "available" &&
    name.trim() !== "" &&
    !saving &&
    !avatarError;

  const initial = (currentDisplayName ?? "?").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-recess/70"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(e) => e.stopPropagation()}
        className="punch-card relative z-10 flex min-h-[26rem] w-full max-w-sm flex-col px-6 py-5"
        style={{ ["--manila-stock" as string]: "#E8E2D0" }}
      >
        <OperatorCardHeader title="Profile card" colLabel="JOB PROF">
          <h2 id={titleId} className="sr-only">
            Edit your profile
          </h2>
        </OperatorCardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void handleSave();
          }}
          className="mt-4 flex min-h-0 flex-1 flex-col gap-4"
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative inline-flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-key-blue font-mono text-xl font-bold text-white"
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase">
                Profile picture
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="punch-print text-[11px] tracking-[0.08em]"
                >
                  {avatarPreview ? "Replace →" : "Add photo →"}
                </button>
                {avatarPreview ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarPreview(null);
                      setAvatarError(null);
                    }}
                    className="punch-print text-[11px] opacity-70"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {avatarError ? (
                <p className="mt-1 font-mono text-[10px] text-[var(--print-ink)]">{avatarError}</p>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                void handleAvatarPick(file);
              }}
            />
          </div>

          <div>
            <label
              htmlFor="profile-display-name"
              className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
            >
              Display name
            </label>
            <input
              ref={inputRef}
              id="profile-display-name"
              type="text"
              value={name}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="your_username"
              maxLength={30}
              autoComplete="username"
              className="punch-print-field"
            />
            <div className="mt-1.5 min-h-[18px] font-mono text-[10px]">
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
              {!localError && availability === "idle" && name === "" ? (
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
              {saving ? "Saving…" : "Save →"}
            </button>
            <button type="button" onClick={onClose} className="punch-print text-[11px] opacity-70">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
