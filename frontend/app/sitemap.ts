import type { MetadataRoute } from "next";

const SITE_URL = "https://www.cleanote.in";

export const dynamic = "force-static";

const WEEKLY_ROUTES = new Set(["", "/handwriting-to-text"]);

const ROUTE_PRIORITY: Record<string, number> = {
  "": 1,
  "/handwriting-to-text": 0.95,
  "/homework-scanner": 0.9,
  "/app": 0.9,
  "/mobile": 0.8,
  "/kashmiri-translator": 0.35
};

const DEFAULT_PRIORITY = 0.6;

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/handwriting-to-text",
    "/homework-scanner",
    "/app",
    "/mobile",
    "/guides",
    "/guides/convert-handwritten-notes-to-text",
    "/guides/scan-homework-worksheets",
    "/guides/how-handwriting-ocr-works",
    "/guides/why-handwriting-ocr-makes-mistakes",
    "/guides/organize-digital-study-notes",
    "/guides/scanning-math-notes",
    "/kids",
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
    changeFrequency: WEEKLY_ROUTES.has(route) ? "weekly" : "monthly",
    priority: ROUTE_PRIORITY[route] ?? DEFAULT_PRIORITY
  }));
}
