"use client";

import { AuthModal } from "@/components/AuthModal";
import { CrochetMark } from "@/components/CrochetMark";
import {
  resolveNavInitial,
  resolveNavLabel,
  useNavAuth,
} from "@/components/NavAuthProvider";
import type { MachineZone } from "@/components/machine/zones";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type { MachineZone };

const ZONE_LAMPS: { id: MachineZone; label: string; lamp: string; href: string }[] = [
  { id: "primer", label: "Manual", lamp: "punch-lamp punch-lamp-blue", href: "/?zone=primer" },
  { id: "hopper", label: "Hopper", lamp: "punch-lamp punch-lamp-red", href: "/?zone=hopper" },
  { id: "reader", label: "Program", lamp: "punch-lamp punch-lamp-green", href: "/?zone=reader" },
];

type Props = {
  /** Lit zone on the home machine; null on legal pages. */
  activeZone?: MachineZone | null;
  /** When set, zone lamps call this instead of navigating (SPA shell). */
  onSelectZone?: (zone: MachineZone) => void;
  /** Hide small Privacy/Terms links (legal pages already are those). */
  hideLegalLinks?: boolean;
};

/** Shared IBM keyboard footer used by MachineShell and legal pages. */
export function MachineKeyboardBar({
  activeZone = null,
  onSelectZone,
  hideLegalLinks = false,
}: Props) {
  const router = useRouter();
  const {
    supabase,
    user,
    displayName,
    avatarUrl,
    profileLoading,
  } = useNavAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const label = resolveNavLabel(user, displayName, profileLoading);
  const initial = resolveNavInitial(user, displayName, profileLoading);

  const goZone = (id: MachineZone) => {
    if (onSelectZone) onSelectZone(id);
    else router.push(ZONE_LAMPS.find((z) => z.id === id)?.href ?? "/");
  };

  return (
    <>
      <nav
        data-machine-keyboard
        className="relative z-40 shrink-0 border-t-2 border-black"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative z-[2] flex items-stretch gap-2 px-2 py-3 sm:gap-3 sm:px-5 md:px-8">
          <Link
            href="/?zone=primer"
            className="hidden shrink-0 items-center gap-2 self-center font-mono text-[14px] font-bold tracking-[0.1em] text-white/90 uppercase no-underline sm:inline-flex"
          >
            <CrochetMark size={26} variant="onChassis" />
            Gridwork
          </Link>

          <div className="flex min-w-0 flex-1 items-stretch justify-center gap-4 sm:gap-5">
            {ZONE_LAMPS.map((key) => {
              const lit = activeZone === key.id;
              return (
                <button
                  key={key.id}
                  type="button"
                  onClick={() => goZone(key.id)}
                  className={`${key.lamp} flex w-[22%] max-w-[9.5rem] flex-none !min-h-[56px] flex-col justify-center !px-2 text-[11px] sm:!min-h-[60px] sm:text-[12px] ${
                    lit ? "is-lit" : "is-dim"
                  }`}
                >
                  {key.label}
                </button>
              );
            })}

            <div className="relative flex w-[24%] max-w-[10.5rem] flex-none">
              {user ? (
                <button
                  type="button"
                  onClick={() => goZone("maker")}
                  className={`punch-lamp punch-lamp-amber flex w-full !min-h-[56px] items-center justify-center gap-2 !px-2 text-[11px] sm:!min-h-[60px] sm:text-[12px] ${
                    activeZone === "maker" ? "is-lit" : "is-dim"
                  }`}
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/30 text-[10px] font-bold text-white">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initial
                    )}
                  </span>
                  <span className="max-w-[7rem] truncate">{label || "Profile"}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="punch-lamp punch-lamp-amber is-lit flex w-full !min-h-[56px] flex-col justify-center !px-2 text-[11px] sm:!min-h-[60px] sm:text-[12px]"
                >
                  Log in
                </button>
              )}
            </div>
          </div>

          {!hideLegalLinks && (
            <div className="hidden shrink-0 items-center gap-2 self-center md:flex">
              <Link href="/privacy" className="font-mono text-[8px] font-bold tracking-[0.1em] text-white/55 uppercase hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="font-mono text-[8px] font-bold tracking-[0.1em] text-white/55 uppercase hover:text-white">
                Terms
              </Link>
            </div>
          )}
        </div>
      </nav>

      <AuthModal
        key={authOpen ? "open" : "closed"}
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        supabase={supabase}
        supabaseReady={Boolean(supabase)}
      />
    </>
  );
}
