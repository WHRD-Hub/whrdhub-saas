import type { MetadataRoute } from "next";

// share_target is part of the web app manifest spec but not yet in Next's type, so it is added on top of it.
type WithShare = MetadataRoute.Manifest & {
  share_target: {
    action: string;
    method: "POST";
    enctype: string;
    params: { title: string; text: string; url: string; files: { name: string; accept: string[] }[] };
  };
};

export default function manifest(): WithShare {
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
    // Once installed, WHRD Hub appears in the share menu: sharing a link, screenshot or
    // photo to it opens a report with that already attached, ready to add what happened and send.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "media", accept: ["image/*", "application/pdf"] }],
      },
    },
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
