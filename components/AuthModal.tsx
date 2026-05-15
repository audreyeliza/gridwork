"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useId, useState } from "react";

type AuthMode = "signin" | "signup";

export type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  supabase: SupabaseClient | null;
  /** False until client has finished resolving env + client (avoids false "not configured" before init). */
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
        className="absolute inset-0 bg-stone-900/35"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md rounded-2xl border border-brand/20 bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-stone-800">
          {mode === "signin" ? "Log in" : "Sign up"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          {mode === "signin" ? "Welcome back." : "Create an account to save patterns."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand/20 bg-white px-3 py-2 text-stone-900 outline-none ring-brand/30 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand/20 bg-white px-3 py-2 text-stone-900 outline-none ring-brand/30 focus:ring-2"
            />
          </div>

          {!supabaseReady ? (
            <p className="text-sm text-stone-500">Connecting to services…</p>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !supabaseReady}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-600">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="font-medium text-accent underline decoration-accent/30 hover:text-accent-dark"
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
                className="font-medium text-accent underline decoration-accent/30 hover:text-accent-dark"
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

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-stone-200 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
