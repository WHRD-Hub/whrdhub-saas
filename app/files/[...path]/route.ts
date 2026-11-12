import { BUCKETS, getPublicObject, isBucket, safeKey } from "@/lib/storage/neon";

/**
 * Public documents, covers and media, served from this site's own domain.
 *
 * Only the public buckets are served here. Anything else, or a file that is not
 * there, gets a page written for a visitor rather than the storage service's
 * raw error. The headers keep search and AI crawlers out and let the CDN keep
 * each file, so repeat downloads do not each reach storage.
 */

export const dynamic = "force-dynamic";

const FILE_HEADERS = {
  "X-Robots-Tag": "noindex, noai, noimageai",
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

// Kept for the visitor and never cached: a missing file may well be added later.
const PAGE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, noai, noimageai",
};

function unavailablePage(status: 404 | 503): Response {
  const heading =
    status === 404 ? "This file is not available yet" : "This file cannot be opened right now";
  const message =
    status === 404
      ? "We are moving the Hub's library of publications to a new home, and this document is not there yet. It will be back soon. If you need it now, contact the Hub and we will send you a copy."
      : "Something went wrong while opening this file. Please try again in a few minutes.";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, noimageindex">
<title>${heading} · WHRD Hub</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #faf7fc; color: #2a1d35; }
  main { max-width: 520px; background: #fff; border: 1px solid #e7dcef; border-radius: 16px; padding: 32px; }
  .mark { width: 48px; height: 48px; border-radius: 12px; background: #f1e9f7; display: grid; place-items: center;
          color: #6b2fa0; font-size: 24px; margin-bottom: 16px; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  p { line-height: 1.6; margin: 0 0 20px; color: #5b4a68; }
  a.button { display: inline-block; background: #6b2fa0; color: #fff; text-decoration: none; font-weight: 700;
             padding: 12px 18px; border-radius: 10px; }
  a.button:hover { background: #572685; }
  .code { font-size: 12px; color: #8a7d95; margin-top: 20px; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1322; color: #f1e9f7; }
    main { background: #241a2e; border-color: #3a2c47; }
    .mark { background: #2f2340; color: #d2b4ee; }
    p { color: #c6b6d4; }
    .code { color: #9a8ba8; }
  }
</style>
</head>
<body>
<main>
  <div class="mark" aria-hidden="true">&#128196;</div>
  <h1>${heading}</h1>
  <p>${message}</p>
  <a class="button" href="/resources">Back to publications</a>
  <p class="code">Error ${status}</p>
</main>
</body>
</html>`;
  return new Response(html, { status, headers: PAGE_HEADERS });
}

async function serve(request: Request, params: { path: string[] }): Promise<Response> {
  const [bucketName, ...parts] = params.path;
  if (!bucketName || !isBucket(bucketName) || !BUCKETS[bucketName].public) return unavailablePage(404);

  let decoded: string;
  try {
    decoded = parts.map((p) => decodeURIComponent(p)).join("/");
  } catch {
    return unavailablePage(404);
  }
  const key = safeKey(decoded);
  if (!key) return unavailablePage(404);

  let file;
  try {
    file = await getPublicObject(bucketName, key);
  } catch (e) {
    console.error("[files] could not read", bucketName, (e as Error).message);
    return unavailablePage(503);
  }
  if (!file) return unavailablePage(404);

  const headers = new Headers({ ...FILE_HEADERS, "Content-Type": file.contentType });
  if (file.contentLength !== undefined) headers.set("Content-Length", String(file.contentLength));
  if (file.etag) headers.set("ETag", file.etag);
  if (file.lastModified) headers.set("Last-Modified", file.lastModified.toUTCString());

  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(file.body, { status: 200, headers });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(request, await params);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return serve(request, await params);
}
