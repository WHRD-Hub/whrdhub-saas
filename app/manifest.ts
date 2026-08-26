import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WHRD Hub",
    short_name: "WHRD Hub",
    description:
      "A secure space for Women Human Rights Defenders to report TFGBV and gender-based abuse, and connect with support services.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#734E9E",
    categories: ["social", "utilities", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Make a report",
        short_name: "Report",
        description: "Securely report an incident",
        url: "/report",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
