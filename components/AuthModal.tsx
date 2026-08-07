"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

type AuthMode = "signin" | "signup" | "forgot";
type Confirmation = { type: "signup" | "reset"; email: string };

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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
    setConfirmation(null);
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
          setEmail("");
          setPassword("");
          onClose();
        } else if (mode === "signup") {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
          });
          if (signUpError) {
            setError(signUpError.message);
            return;
          }
          setPassword("");
          if (!signUpData.session) {
            // Email confirmation required before the account is usable.
            setConfirmation({ type: "signup", email });
            setEmail("");
          } else {
            setEmail("");
            onClose();
          }
        } else {
          const redirectTo =
            typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
          });
          if (resetError) {
            setError(resetError.message);
            return;
          }
          setConfirmation({ type: "reset", email });
          setEmail("");
        }
      } finally {
        setLoading(false);
      }
    },
    [supabase, supabaseReady, mode, email, password, onClose],
  );

  if (!open) return null;

  if (confirmation) {
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
          className="punch-card relative z-10 flex min-h-[20rem] w-full max-w-sm flex-col px-6 py-5"
          style={{ ["--manila-stock" as string]: "#E8E2D0" }}
        >
          <OperatorCardHeader
            title={confirmation.type === "signup" ? "Confirm email card" : "Reset sent card"}
            colLabel="JOB AUTH"
          >
            <h2 id={titleId} className="sr-only">
              {confirmation.type === "signup" ? "Confirm your email" : "Password reset sent"}
            </h2>
          </OperatorCardHeader>

          <div className="mt-6 flex flex-1 flex-col justify-center gap-3">
            <p className="font-mono text-[12px] leading-relaxed punch-print-ink">
              {confirmation.type === "signup"
                ? `We sent a confirmation link to ${confirmation.email}. Click it to activate your account.`
                : `If an account exists for ${confirmation.email}, we sent a password reset link. Check your inbox.`}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setConfirmation(null);
                setMode("signin");
              }}
              className="punch-print text-[11px]"
            >
              Back to log in
            </button>
            <button type="button" onClick={onClose} className="punch-print text-[11px] opacity-70">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          title={mode === "signin" ? "Log in card" : mode === "signup" ? "Sign up card" : "Reset password card"}
          colLabel="JOB AUTH"
        >
          <h2 id={titleId} className="sr-only">
            {mode === "signin" ? "Log in" : mode === "signup" ? "Sign up" : "Reset password"}
          </h2>
        </OperatorCardHeader>

        {mode !== "forgot" ? (
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
        ) : (
          <p className="mt-4 font-mono text-[11px] leading-relaxed punch-print-faint">
            Enter your account email and we&apos;ll send you a link to reset your password.
          </p>
        )}

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

          {mode !== "forgot" ? (
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
              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                  className="punch-print mt-1.5 text-[10px] opacity-70"
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
          ) : null}

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
                {loading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Log in →"
                    : mode === "signup"
                      ? "Sign up →"
                      : "Send reset link →"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === "forgot") {
                    setMode("signin");
                    setError(null);
                  } else {
                    onClose();
                  }
                }}
                className="punch-print text-[11px] opacity-70"
              >
                {mode === "forgot" ? "Back" : "Cancel"}
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
