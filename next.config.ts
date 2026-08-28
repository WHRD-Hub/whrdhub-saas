import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Serve stored files from this domain rather than Supabase's.
   *
   * Supabase returns absolute URLs on its own host, so without this a visitor
   * opening one of the Hub's own publications sees `<ref>.supabase.co` in the
   * address bar. The rewrite proxies the public storage endpoint; `hubFile()`
   * in lib/file-url.ts maps stored URLs onto it, so nothing in the database
   * has to be rewritten.
   *
   * Only the *public* buckets are reachable this way. Report evidence lives in
   * a private bucket and is still reached with a signed, expiring URL — there
   * is deliberately no proxy for it.
   */
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return [];
    return [
      {
        source: "/files/:path*",
        destination: `${base.replace(/\/$/, "")}/storage/v1/object/public/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "whrdhub.org" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
