"use client";

import { OperatorCardHeader } from "@/components/OperatorCardHeader";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";

type Status = "checking" | "ready" | "invalid" | "success";

export default function ResetPasswordPage() {
  const titleId = useId();
  const [supabase] = useState(() => {
    try {
      return getSupabaseBrowserClient();
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<Status>(supabase ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setStatus("ready");
      } else if (event === "INITIAL_SESSION") {
        setStatus("invalid");
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      setLoading(true);
      try {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setStatus("success");
      } finally {
        setLoading(false);
      }
    },
    [password, confirmPassword, supabase],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="punch-card relative flex min-h-[24rem] w-full max-w-sm flex-col px-6 py-5"
        style={{ ["--manila-stock" as string]: "#E8E2D0" }}
      >
        <OperatorCardHeader title="Reset password card" colLabel="JOB AUTH">
          <h1 id={titleId} className="sr-only">
            Reset your password
          </h1>
        </OperatorCardHeader>

        {status === "checking" ? (
          <div className="mt-6 flex flex-1 items-center justify-center">
            <p className="font-mono text-[11px] punch-print-faint">Verifying reset link…</p>
          </div>
        ) : null}

        {status === "invalid" ? (
          <div className="mt-6 flex flex-1 flex-col justify-center gap-4">
            <p className="font-mono text-[12px] leading-relaxed punch-print-ink">
              This reset link is invalid or has expired. Request a new one from the log in card.
            </p>
            <Link href="/" className="punch-print text-[11px]">
              ← Back to Gridwork
            </Link>
          </div>
        ) : null}

        {status === "success" ? (
          <div className="mt-6 flex flex-1 flex-col justify-center gap-4">
            <p className="font-mono text-[12px] leading-relaxed punch-print-ink">
              Your password has been updated.
            </p>
            <Link href="/" className="punch-print text-[11px]">
              Continue to Gridwork →
            </Link>
          </div>
        ) : null}

        {status === "ready" ? (
          <form onSubmit={handleSubmit} className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
            <div>
              <label
                htmlFor="new-password"
                className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
              >
                New password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="punch-print-field"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block font-mono text-[10px] font-bold tracking-[0.12em] text-[var(--print-ink)] uppercase"
              >
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="punch-print-field"
              />
            </div>

            {error ? (
              <p className="font-mono text-[11px] text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-auto pt-4">
              <button
                type="submit"
                disabled={loading}
                className="punch-print text-[12px] tracking-[0.1em]"
              >
                {loading ? "Please wait…" : "Set new password →"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
