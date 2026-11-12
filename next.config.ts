import type { NextConfig } from "next";

/**
 * Browser security headers, sent on every response.
 *
 * The Content-Security-Policy lists exactly what the application loads: its own
 * files, Supabase (data, sign-in, storage), the Leaflet map library from unpkg,
 * CARTO map tiles, and https embeds of posts and videos shown in the feed and
 * the listening console. Everything else is refused. Inline scripts are allowed
 * because Next.js writes small inline bootstrap scripts; eval is allowed only in
 * development (hot reload needs it). A page cannot be put inside someone else's
 * frame, and the browser is told never to guess a file's type.
 */
const isDev = process.env.NODE_ENV !== "production";
const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host; } catch { return "*.supabase.co"; } })();
// The Neon Data API: the browser queries it directly with the signed-in person's token.
const dataApiHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_NEON_DATA_API_URL ?? "").host; } catch { return ""; } })();
// Neon Object Storage: the browser sends uploads straight there, using a short-lived signed URL.
const storageHost = (() => { try { return new URL(process.env.AWS_ENDPOINT_URL_S3 ?? "").host; } catch { return ""; } })();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://unpkg.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}${dataApiHost ? ` https://${dataApiHost}` : ""}${storageHost ? ` https://${storageHost}` : ""}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "frame-src https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pages that show a person's own data are never kept by a shared cache.
      { source: "/(dashboard|hub|profile|mentorship)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },

  images: {
    // Covers are resized once and the result kept for a month, so Supabase
    // Storage is asked for the original rarely rather than once per visitor.
    // Replacing a cover means uploading it under a new name.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    remotePatterns: [
      { protocol: "https", hostname: "whrdhub.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
