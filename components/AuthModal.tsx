"use client";

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
        className="punch-card relative z-10 w-full max-w-md px-7 py-6"
        style={{ ["--manila-stock" as string]: "#E8E2D0" }}
      >
        <p className="font-mono text-[9px] font-bold tracking-[0.16em] text-[var(--print-ink-faint)] uppercase">
          Operator card
        </p>
        <h2 id={titleId} className="mt-1 font-mono text-lg font-bold tracking-[0.04em] text-[var(--print-ink)] uppercase">
          {mode === "signin" ? "Log in" : "Sign up"}
        </h2>
        <p className="mt-1 font-mono text-[12px] text-[var(--print-ink-faint)]">
          {mode === "signin" ? "Welcome back." : "Create an account to save patterns."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <div>
            <label htmlFor="auth-email" className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase">
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
            <label htmlFor="auth-password" className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase">
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
            <p className="font-mono text-sm text-[var(--print-ink-faint)]">Connecting to services…</p>
          ) : null}

          {error ? (
            <p className="font-mono text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !supabaseReady}
            className="punch-print justify-start text-[12px] tracking-[0.1em]"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Log in →" : "Sign up →"}
          </button>

          {mode === "signup" && (
            <p className="font-mono text-[11px] text-[var(--print-ink-faint)]">
              By signing up you agree to our{" "}
              <Link href="/terms" className="punch-print inline text-[11px]">Terms</Link>
              {" "}and{" "}
              <Link href="/privacy" className="punch-print inline text-[11px]">Privacy Policy</Link>
            </p>
          )}
        </form>

        <div className="mt-8 flex flex-col gap-4 border-t border-[color-mix(in_srgb,var(--print-ink)_18%,transparent)] pt-5">
          <p className="m-0 font-mono text-[12px] text-[var(--print-ink-faint)]">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  className="punch-print inline text-[12px]"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="punch-print inline text-[12px]"
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                >
                  Log in
                </button>
              </>
            )}
          </p>

          <button type="button" onClick={onClose} className="punch-print self-start text-[11px]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
