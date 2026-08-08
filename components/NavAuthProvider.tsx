"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";
import { fetchProfile } from "@/lib/profileHelpers";

type NavAuthContextValue = {
  supabase: SupabaseClient | null;
  user: User | null;
  displayName: string | null;
  avatarUrl: string | null;
  profileLoading: boolean;
  setDisplayName: (name: string | null) => void;
  setAvatarUrl: (url: string | null) => void;
  signOut: () => Promise<void>;
};

const NavAuthContext = createContext<NavAuthContextValue | null>(null);

const PROFILE_CACHE_KEY = "gridwork:nav-profile";

type CachedProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

function readCachedProfile(userId: string): CachedProfile | null {
  try {
    const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: CachedProfile) {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearCachedProfile() {
  try {
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function NavAuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = (attempt: number) => {
      if (cancelled) return;
      let client: SupabaseClient;
      try {
        client = getSupabaseBrowserClient();
      } catch {
        if (attempt < 1 && !cancelled) {
          resetSupabaseBrowserClient();
          setTimeout(() => run(attempt + 1), 50);
        }
        return;
      }
      if (cancelled) return;
      setSupabase(client);
      void client.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) setUser(session?.user ?? null);
      });
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        if (!cancelled) setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    };
    const cleanup = run(0);
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears profile state on logout; must react to auth changes
      setDisplayName(null);
      setAvatarUrl(null);
      setProfileLoading(false);
      if (!user) clearCachedProfile();
      return;
    }

    const cached = readCachedProfile(user.id);
    if (cached) {
      setDisplayName(cached.displayName);
      setAvatarUrl(cached.avatarUrl);
      setProfileLoading(false);
    } else {
      setDisplayName(null);
      setAvatarUrl(null);
      setProfileLoading(true);
    }

    let cancelled = false;
    void fetchProfile(supabase, user.id).then(({ data }) => {
      if (cancelled) return;
      const nextName = data?.display_name ?? null;
      const nextAvatar = data?.avatar_url ?? null;
      setDisplayName(nextName);
      setAvatarUrl(nextAvatar);
      setProfileLoading(false);
      writeCachedProfile({
        userId: user.id,
        displayName: nextName,
        avatarUrl: nextAvatar,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    clearCachedProfile();
    await supabase.auth.signOut();
  }, [supabase]);

  const setDisplayNameCached = useCallback(
    (name: string | null) => {
      setDisplayName(name);
      if (user) {
        writeCachedProfile({
          userId: user.id,
          displayName: name,
          avatarUrl,
        });
      }
    },
    [user, avatarUrl],
  );

  const setAvatarUrlCached = useCallback(
    (url: string | null) => {
      setAvatarUrl(url);
      if (user) {
        writeCachedProfile({
          userId: user.id,
          displayName,
          avatarUrl: url,
        });
      }
    },
    [user, displayName],
  );

  const value = useMemo(
    () => ({
      supabase,
      user,
      displayName,
      avatarUrl,
      profileLoading,
      setDisplayName: setDisplayNameCached,
      setAvatarUrl: setAvatarUrlCached,
      signOut,
    }),
    [
      supabase,
      user,
      displayName,
      avatarUrl,
      profileLoading,
      setDisplayNameCached,
      setAvatarUrlCached,
      signOut,
    ],
  );

  return <NavAuthContext.Provider value={value}>{children}</NavAuthContext.Provider>;
}

export function useNavAuth(): NavAuthContextValue {
  const ctx = useContext(NavAuthContext);
  if (!ctx) {
    throw new Error("useNavAuth must be used within NavAuthProvider");
  }
  return ctx;
}

/** Label for nav: never flash email while profile is still loading. */
export function resolveNavLabel(
  user: User | null,
  displayName: string | null,
  profileLoading: boolean,
): string {
  if (!user) return "";
  if (displayName) return `@${displayName}`;
  if (profileLoading) return "";
  return user.email ?? "";
}

export function resolveNavInitial(
  user: User | null,
  displayName: string | null,
  profileLoading: boolean,
): string {
  if (displayName) return displayName.charAt(0).toUpperCase();
  if (profileLoading || !user) return "?";
  return (user.email ?? "?").charAt(0).toUpperCase();
}
