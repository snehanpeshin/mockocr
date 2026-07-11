import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cleanote",
    short_name: "Cleanote",
    description: "Capture handwritten pages as editable text you can review, save, and export.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8fb",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/cleanote-icon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
