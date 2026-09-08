import crypto from "crypto";

/**
 * Meta (Facebook / Instagram) Graph API + webhook helpers for online listening.
 *
 * IMPORTANT — what Meta actually allows: there is no API that "listens" to all
 * of Facebook/Instagram for keywords. Nothing you can buy or apply for gives
 * that. You can only read content on assets you own or manage — your Page's
 * own posts and the comments on them, mentions of your Page, an Instagram
 * business account you administer — or apply to Meta's Content Library API as
 * an approved researcher. This module watches the connected Page. It activates
 * only when the env vars below are set; otherwise every call is a safe no-op.
 *
 * Env — the two that decide whether anything works at all:
 *   META_PAGE_ID             numeric id of the Page whose content we watch
 *   META_PAGE_ACCESS_TOKEN   a long-lived *Page* access token for that Page
 *                            (META_ACCESS_TOKEN is accepted as an alias, because
 *                            an earlier version of this file read that name and
 *                            some deployments still set it)
 *
 * And the two the webhook needs:
 *   META_APP_SECRET      app secret, used to verify webhook signatures
 *   META_VERIFY_TOKEN    the string you type into the webhook setup form
 *
 * Optional:
 *   META_GRAPH_VERSION   e.g. v21.0 (defaults below)
 *
 * An App ID and App Secret on their own are NOT enough. They yield an app
 * access token, which cannot read a Page feed. See metaDiagnose() below, which
 * says so in as many words rather than failing silently.
 */

const VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const PAGE_ID = process.env.META_PAGE_ID || "";
const TOKEN = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";
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

async function graph(path: string, params: Record<string, string> = {}, token = TOKEN) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = await res.text();
  if (!res.ok) {
    // Meta puts the useful sentence in error.message; the status alone is noise.
    let detail = body.slice(0, 300);
    try {
      const j = JSON.parse(body) as { error?: { message?: string; type?: string; code?: number } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      /* non-JSON error body; the raw text is the best we have */
    }
    throw new Error(`Graph ${path} (${res.status}): ${detail}`);
  }
  return JSON.parse(body);
}

export interface MetaDiagnosis {
  /** True only when a real Page feed request came back with data we could read. */
  canPull: boolean;
  /** One sentence a non-engineer can act on. */
  summary: string;
  /** Ordered checks, each already phrased for display. */
  checks: { name: string; ok: boolean; detail: string }[];
}

/**
 * Actually try to pull, and report what happened.
 *
 * This exists because every failure mode here is silent. A missing env var, an
 * app token where a Page token is needed, an expired token, a Page the token
 * does not administer, a missing pages_read_engagement permission — all of them
 * end with an empty listening screen and no explanation. Running the real
 * request and reading the real error is the only honest way to answer "is this
 * connected?", so that is what this does.
 */
export async function metaDiagnose(): Promise<MetaDiagnosis> {
  const checks: MetaDiagnosis["checks"] = [];

  const havePage = !!PAGE_ID;
  const haveToken = !!TOKEN;
  checks.push({
    name: "META_PAGE_ID",
    ok: havePage,
    detail: havePage ? `Set (${PAGE_ID}).` : "Not set. This is the numeric id of the Facebook Page to watch.",
  });
  checks.push({
    name: "META_PAGE_ACCESS_TOKEN",
    ok: haveToken,
    detail: haveToken
      ? "Set."
      : "Not set. This must be a Page access token — an App ID and App Secret cannot read a Page feed.",
  });
  checks.push({
    name: "META_APP_SECRET",
    ok: !!APP_SECRET,
    detail: APP_SECRET ? "Set — webhook signatures will be verified." : "Not set. Live webhook events will be rejected; only manual Sync will work.",
  });
  checks.push({
    name: "META_VERIFY_TOKEN",
    ok: !!META_VERIFY_TOKEN,
    detail: META_VERIFY_TOKEN ? "Set." : "Not set. Meta's webhook verification handshake will fail.",
  });

  if (!havePage || !haveToken) {
    return {
      canPull: false,
      summary:
        "Not connected. The Page id and a Page access token are both required, and at least one is missing — so nothing can be pulled yet.",
      checks,
    };
  }

  // What kind of token is this, and does it still work?
  let tokenKind = "unknown";
  try {
    const me = await graph("me", { fields: "id,name" });
    tokenKind = me.id === PAGE_ID ? "page" : "user-or-other";
    checks.push({
      name: "Token is valid",
      ok: true,
      detail:
        tokenKind === "page"
          ? `Yes — it is a Page token for "${me.name}".`
          : `Yes, but it identifies "${me.name}" (${me.id}), not the Page in META_PAGE_ID. A Page token is what this needs.`,
    });
  } catch (err) {
    checks.push({ name: "Token is valid", ok: false, detail: msg(err) });
    return { canPull: false, summary: "The access token was rejected by Meta. " + msg(err), checks };
  }

  // The question that actually matters.
  try {
    const feed = await graph(`${PAGE_ID}/feed`, { fields: "id,message,created_time", limit: "3" });
    const n = (feed.data ?? []).length;
    checks.push({
      name: "Read the Page feed",
      ok: true,
      detail: n ? `Yes — ${n} recent post(s) returned.` : "Yes, the request succeeded, but the Page has no posts to read yet.",
    });
    return {
      canPull: true,
      summary: n
        ? `Connected. Meta returned ${n} recent post(s), so listening can pull content and match keywords against it.`
        : "Connected and authorised, but this Page has no posts yet, so there is nothing to scan.",
      checks,
    };
  } catch (err) {
    checks.push({ name: "Read the Page feed", ok: false, detail: msg(err) });
    return {
      canPull: false,
      summary:
        "The token works, but it cannot read this Page's feed — usually a missing pages_read_engagement permission, or a Page the token does not administer. " +
        msg(err),
      checks,
    };
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
