import type { MetadataRoute } from "next";

const SITE_URL = "https://gridwork-seven.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/hopper", "/program", "/privacy", "/terms"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.6,
  }));
}
