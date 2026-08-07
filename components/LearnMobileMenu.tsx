"use client";

import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { MobileMenuOverlay } from "@/components/MobileMenuOverlay";
import { resolveNavInitial, useNavAuth } from "@/components/NavAuthProvider";

/** @deprecated Prefer NavUserSection — kept for any stray imports. */
export function LearnMobileMenu() {
  const { supabase, user, displayName, avatarUrl, profileLoading, signOut } = useNavAuth();
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const initial = resolveNavInitial(user, displayName, profileLoading);

  return (
    <>
      <div className="flex items-center gap-3.5 md:hidden">
        {user ? (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white"
            style={{
              background: avatarUrl ? undefined : "#5B7EC9",
              border: "1.5px solid rgba(255,255,255,0.55)",
            }}
            aria-hidden="true"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/30"
          aria-label="Menu"
        >
          ☰
        </button>
      </div>
      <MobileMenuOverlay
        open={open}
        onClose={() => setOpen(false)}
        activePage="learn"
        user={user}
        userDisplayName={displayName}
        userAvatarUrl={avatarUrl}
        profileLoading={profileLoading}
        onLogin={() => setAuthModalOpen(true)}
        onLogout={() => void signOut().then(() => setOpen(false))}
      />
      <AuthModal
        key={authModalOpen ? "auth-open" : "auth-closed"}
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        supabase={supabase}
        supabaseReady={Boolean(supabase)}
      />
    </>
  );
}
