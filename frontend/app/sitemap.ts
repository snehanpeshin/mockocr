import type { MetadataRoute } from "next";

const SITE_URL = "https://www.cleanote.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/app",
    "/mobile",
    "/login",
    "/support",
    "/privacy",
    "/terms",
    "/refund",
    "/delete-account",
    "/kashmiri-translator"
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}/`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/app" || route === "/mobile" ? 0.9 : 0.6
  }));
}
