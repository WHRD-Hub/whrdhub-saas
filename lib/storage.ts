import { createAdminClient } from "@/lib/supabase/admin";
import { HUB_FILE_PREFIX, hubFile } from "@/lib/file-url";
import { isPrintedFile } from "@/lib/file-links";

/**
 * Every published document and cover image must live in the Hub's own storage,
 * not on someone else's server. Files uploaded through the admin form land in
 * the `publications` bucket directly; files pasted as links are fetched once,
 * server-side, and copied into the same bucket. See supabase/012_publications_bucket.sql.
 */

export const PUBLICATIONS_BUCKET = "publications";

/** 100 MB, matching the bucket's file_size_limit. */
const MAX_BYTES = 100 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 45_000;

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

const ALLOWED = new Set(Object.keys(EXT_BY_TYPE));

/**
 * True when the URL already points at the Hub's own storage: a `/files/...`
 * address on this site, or an address saved while the files lived on Supabase
 * (those are served through `/files` too, see lib/file-url.ts).
 */
export function isStoredHere(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith(HUB_FILE_PREFIX)) return true;
  return hubFile(url).startsWith(HUB_FILE_PREFIX);
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "document"
  );
}

function extensionFor(url: string, contentType: string): string {
  const fromType = EXT_BY_TYPE[contentType];
  if (fromType) return fromType;
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    if (m) return m[1].toLowerCase();
  } catch {
    /* fall through */
  }
  return "bin";
}

export interface StoreResult {
  /** The URL to save on the row — the bucket copy when the copy succeeded. */
  url: string;
  /** True when this call wrote a new object into the bucket. */
  mirrored: boolean;
  /** Set when the file could not be copied; the original URL is kept. */
  warning?: string;
}

/**
 * Ensure `url` is served from the publications bucket. A URL already in our
 * storage is returned untouched. Anything else is downloaded once and uploaded.
 *
 * Never throws: if the source cannot be fetched we keep the original link and
 * report a warning, so a bad third-party host can't block an admin from saving.
 */
export async function storeInBucket(
  url: string | null | undefined,
  opts: { folder: "documents" | "covers"; name: string },
): Promise<StoreResult> {
  const src = (url ?? "").trim();
  if (!src) return { url: "", mirrored: false };
  if (isStoredHere(src)) return { url: src, mirrored: false };
  if (!/^https?:\/\//i.test(src)) return { url: src, mirrored: false, warning: "Not a downloadable link." };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(src, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);

    if (!res.ok) return { url: src, mirrored: false, warning: `Could not download the file (HTTP ${res.status}).` };

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (contentType && !ALLOWED.has(contentType)) {
      return { url: src, mirrored: false, warning: `That link is a ${contentType || "file"}, which we don't store.` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0) return { url: src, mirrored: false, warning: "The file came back empty." };
    if (buffer.byteLength > MAX_BYTES) {
      return { url: src, mirrored: false, warning: "That file is larger than 100 MB." };
    }

    const ext = extensionFor(src, contentType);
    const path = `${opts.folder}/${slugify(opts.name)}-${Date.now().toString(36)}.${ext}`;

    const admin = createAdminClient();
    const { error } = await admin.storage.from(PUBLICATIONS_BUCKET).upload(path, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });
    if (error) return { url: src, mirrored: false, warning: error.message };

    const { data } = admin.storage.from(PUBLICATIONS_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, mirrored: true };
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "the download timed out" : "the download failed";
    return { url: src, mirrored: false, warning: `Kept the original link — ${reason}.` };
  }
}

/**
 * Remove an object from the publications bucket, given its public URL.
 *
 * A file whose address is in print is never removed: replacing a document in
 * the Hub must not turn the address on a banner or a leaflet into a dead link.
 */
export async function removeFromBucket(url: string | null | undefined): Promise<void> {
  if (!isStoredHere(url)) return;
  try {
    const prefix = `${HUB_FILE_PREFIX}${PUBLICATIONS_BUCKET}/`;
    const mapped = hubFile(url).split("?")[0];
    if (!mapped.startsWith(prefix)) return;
    const path = decodeURIComponent(mapped.slice(prefix.length));
    if (!path || isPrintedFile(PUBLICATIONS_BUCKET, path)) return;
    const admin = createAdminClient();
    await admin.storage.from(PUBLICATIONS_BUCKET).remove([path]);
  } catch {
    // A file that cannot be removed is not worth failing the request over.
  }
}
