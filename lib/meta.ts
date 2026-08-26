import crypto from "crypto";

/**
 * Meta (Facebook / Instagram) Graph API + webhook helpers for online listening.
 *
 * IMPORTANT — what Meta actually allows: there is no API that "listens" to all
 * of Facebook/Instagram for keywords. You can only read content on assets you
 * own or manage (your Page's posts/comments/mentions, an IG business account),
 * or use Meta's Content Library API with approved researcher access. This module
 * watches the connected Page via the Graph API + webhooks. It activates only
 * when the META_* env vars are set; otherwise every call is a safe no-op.
 *
 * Env:
 *   META_GRAPH_VERSION   e.g. v21.0 (optional, defaults below)
 *   META_PAGE_ID         the Page whose content we watch
 *   META_ACCESS_TOKEN    a long-lived Page access token
 *   META_APP_SECRET      app secret, used to verify webhook signatures
 *   META_VERIFY_TOKEN    the token you enter in the webhook setup form
 */

const VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const PAGE_ID = process.env.META_PAGE_ID || "";
const TOKEN = process.env.META_ACCESS_TOKEN || "";
export const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const APP_SECRET = process.env.META_APP_SECRET || "";

export function metaConfigured(): boolean {
  return !!(PAGE_ID && TOKEN);
}

export interface Keyword { word: string; severity: string }
export interface RawItem { source: "facebook" | "instagram"; source_id: string; permalink: string | null; author: string | null; content: string }

const SEV_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** Return the keywords present in `text` and the highest severity among them. */
export function matchKeywords(text: string, keywords: Keyword[]): { matched: string[]; severity: string } {
  const hay = ` ${text.toLowerCase()} `;
  const matched: string[] = [];
  let sev = "low";
  for (const k of keywords) {
    const w = k.word.toLowerCase().trim();
    if (!w) continue;
    // word-ish boundary so "assault" does not match inside another token
    if (new RegExp(`[^a-z]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(hay)) {
      matched.push(k.word);
      if ((SEV_RANK[k.severity] ?? 1) > (SEV_RANK[sev] ?? 1)) sev = k.severity;
    }
  }
  return { matched, severity: matched.length ? sev : "low" };
}

async function graph(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${path}`);
  url.searchParams.set("access_token", TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Graph ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Pull recent visible text from the connected Page: post messages and the
 * comments on them. Returns normalized items ready for keyword matching.
 */
export async function fetchRecentContent(limit = 25): Promise<RawItem[]> {
  if (!metaConfigured()) return [];
  const items: RawItem[] = [];
  const feed = await graph(`${PAGE_ID}/feed`, {
    fields: "id,message,permalink_url,created_time,comments.limit(25){id,message,from,permalink_url,created_time}",
    limit: String(limit),
  });
  for (const post of feed.data ?? []) {
    if (post.message) {
      items.push({ source: "facebook", source_id: post.id, permalink: post.permalink_url ?? null, author: "Page post", content: post.message });
    }
    for (const c of post.comments?.data ?? []) {
      if (c.message) {
        items.push({ source: "facebook", source_id: c.id, permalink: c.permalink_url ?? post.permalink_url ?? null, author: c.from?.name ?? "Facebook user", content: c.message });
      }
    }
  }
  return items;
}

/** Verify the X-Hub-Signature-256 header Meta sends on webhook POSTs. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!APP_SECRET) return false;
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Flatten a webhook payload into raw items (Page feed change events). */
export function itemsFromWebhook(payload: unknown): RawItem[] {
  const out: RawItem[] = [];
  const body = payload as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] };
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const message = (v.message as string) || (v.text as string) || "";
      const id = (v.comment_id as string) || (v.post_id as string) || (v.id as string) || "";
      if (message && id) {
        out.push({
          source: "facebook",
          source_id: id,
          permalink: (v.permalink_url as string) || null,
          author: ((v.from as { name?: string })?.name) || "Facebook user",
          content: message,
        });
      }
    }
  }
  return out;
}
