import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Pin Turbopack to this package so `.env.local` and `NEXT_PUBLIC_*` resolve here (avoids wrong root when multiple lockfiles exist). */
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
