export type MachineZone = "manual" | "hopper" | "program" | "profile";

/** Path for each machine zone (zone query params are legacy). */
export const ZONE_PATHS: Record<MachineZone, string> = {
  manual: "/",
  hopper: "/hopper",
  program: "/program",
  profile: "/profile",
};

export function pathForZone(zone: MachineZone): string {
  return ZONE_PATHS[zone];
}

export function zoneFromPathname(pathname: string): MachineZone {
  if (
    pathname === "/hopper" ||
    pathname.startsWith("/hopper/") ||
    pathname === "/gallery" ||
    pathname.startsWith("/gallery/")
  ) {
    return "hopper";
  }
  if (
    pathname === "/program" ||
    pathname.startsWith("/program/") ||
    pathname === "/editor" ||
    pathname.startsWith("/editor/")
  ) {
    return "program";
  }
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "profile";
  return "manual";
}

/** Parse ?zone= including legacy primer/reader/maker names. */
export function parseZoneQuery(raw: string | null): MachineZone | null {
  if (raw === "manual" || raw === "hopper" || raw === "program" || raw === "profile") return raw;
  if (raw === "primer") return "manual";
  if (raw === "reader") return "program";
  if (raw === "maker") return "profile";
  return null;
}

/** Build a zone href, optionally carrying pattern / q / tutorial query keys. */
export function buildZoneHref(
  zone: MachineZone,
  opts?: {
    pattern?: string | null;
    q?: string | null;
    tutorial?: boolean;
    /** Copy pattern / q / tutorial from existing search params when opts omit them. */
    preserve?: URLSearchParams | null;
  },
): string {
  const path = pathForZone(zone);
  const params = new URLSearchParams();

  const pattern =
    opts?.pattern !== undefined ? opts.pattern : opts?.preserve?.get("pattern") ?? null;
  if (pattern) params.set("pattern", pattern);

  const q = opts?.q !== undefined ? opts.q : opts?.preserve?.get("q") ?? null;
  if (q) params.set("q", q);

  const tutorial =
    opts?.tutorial === true ||
    (opts?.tutorial === undefined && opts?.preserve?.get("tutorial") === "1");
  if (tutorial && zone === "program") params.set("tutorial", "1");

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
