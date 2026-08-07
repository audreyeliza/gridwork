import type { MetadataRoute } from "next";

const SITE_URL = "https://gridwork-seven.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/profile", "/print/", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
