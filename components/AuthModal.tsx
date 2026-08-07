"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

type AuthMode = "signin" | "signup";

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  supabaseReady?: boolean;
  initialMode?: AuthMode;
};

export function AuthModal({
  open,
  onClose,
  supabase,
  supabaseReady = true,
  initialMode = "signin",
}: AuthModalProps) {
  const titleId = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!supabaseReady) {
        setError("Still connecting… try again in a moment.");
        return;
      }
      if (!supabase) {
        setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.");
        return;
      }
      setLoading(true);
      try {
        if (mode === "signin") {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setError(signInError.message);
            return;
          }
        } else {
          const { error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) {
            setError(signUpError.message);
            return;
          }
        }
        setEmail("");
        setPassword("");
        onClose();
      } finally {
        setLoading(false);
      }
    },
    [supabase, supabaseReady, mode, email, password, onClose],
  );

  if (!open) return null;

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
        <OperatorCardHeader
          title={mode === "signin" ? "Log in card" : "Sign up card"}
          colLabel="JOB AUTH"
        >
          <h2 id={titleId} className="sr-only">
            {mode === "signin" ? "Log in" : "Sign up"}
          </h2>
        </OperatorCardHeader>

        <div className="mt-4 flex items-center gap-3" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-opacity ${
              mode === "signin"
                ? "punch-print-ink underline decoration-[var(--print-ink)] underline-offset-4"
                : "punch-print-faint hover:opacity-80"
            }`}
          >
            Log in
          </button>
          <span className="font-mono text-[10px] punch-print-faint" aria-hidden>
            ·
          </span>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-opacity ${
              mode === "signup"
                ? "punch-print-ink underline decoration-[var(--print-ink)] underline-offset-4"
                : "punch-print-faint hover:opacity-80"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div>
            <label
              htmlFor="auth-email"
              className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="punch-print-field"
            />
          </div>
          <div>
            <label
              htmlFor="auth-password"
              className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="punch-print-field"
            />
          </div>

          {!supabaseReady ? (
            <p className="font-mono text-[11px] text-[var(--print-ink-faint)]">Connecting…</p>
          ) : null}

          {error ? (
            <p className="font-mono text-[11px] text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={loading || !supabaseReady}
                className="punch-print text-[12px] tracking-[0.1em]"
              >
                {loading ? "Please wait…" : mode === "signin" ? "Log in →" : "Sign up →"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="punch-print text-[11px] opacity-70"
              >
                Cancel
              </button>
            </div>

            {mode === "signup" ? (
              <p className="m-0 font-mono text-[10px] text-[var(--print-ink-faint)]">
                <Link href="/terms" className="punch-print inline text-[10px]">
                  Terms
                </Link>
                {" · "}
                <Link href="/privacy" className="punch-print inline text-[10px]">
                  Privacy
                </Link>
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
