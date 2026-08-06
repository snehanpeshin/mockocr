import type { MetadataRoute } from "next";

const SITE_URL = "https://www.cleanote.in";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/handwriting-to-text",
    "/homework-scanner",
    "/guides",
    "/guides/convert-handwritten-notes-to-text",
    "/guides/scan-homework-worksheets",
    "/guides/how-handwriting-ocr-works",
    "/guides/why-handwriting-ocr-makes-mistakes",
    "/guides/organize-digital-study-notes",
    "/guides/scanning-math-notes",
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
    changeFrequency: route === "" || route === "/handwriting-to-text" ? "weekly" : "monthly",
    priority:
      route === ""
        ? 1
        : route === "/handwriting-to-text"
          ? 0.95
          : route === "/homework-scanner"
            ? 0.9
            : route === "/kashmiri-translator"
              ? 0.35
              : 0.6
  }));
}
