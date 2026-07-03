import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WeeklyNom",
    short_name: "WeeklyNom",
    description:
      "A household recipe library, pantry tracker, and shopping list.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ed",
    theme_color: "#1e1b17",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
