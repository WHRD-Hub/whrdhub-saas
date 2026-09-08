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
const APP_ID = process.env.META_APP_ID || "";

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
 * does not administer, a missing pages_read_engagement scope. All of them end
 * in the same blank screen.
 *
 * The single most common mistake, by a distance, is copying the token out of
 * the Graph API Explorer's Access Token box. That is a User token. The Page
 * token is nested inside the me/accounts response, and the two look identical.
 * Meta's own reply to that mistake is a #10 permissions error that sends you
 * off reading about App Review, which is the wrong trail entirely. So when the
 * token turns out not to be a Page token, we say that first and say it plainly.
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
    detail: haveToken ? "Set." : "Not set. This must be a Page access token, not an App ID and secret.",
  });
  checks.push({
    name: "META_APP_SECRET",
    ok: !!APP_SECRET,
    detail: APP_SECRET ? "Set, so webhook signatures will be verified." : "Not set. Live webhook events will be rejected; only manual Sync will work.",
  });
  checks.push({
    name: "META_VERIFY_TOKEN",
    ok: !!META_VERIFY_TOKEN,
    detail: META_VERIFY_TOKEN ? "Set." : "Not set. Meta's webhook verification handshake will fail.",
  });

  if (!havePage || !haveToken) {
    return {
      canPull: false,
      summary: "Not connected. The Page id and a Page access token are both required, and at least one is missing.",
      checks,
    };
  }

  const wrongTokenAdvice =
    `Open the Graph API Explorer, run me/accounts, and copy the access_token from inside the result for Page ${PAGE_ID}. ` +
    `Do not copy the token from the Access Token box at the top: that is a User token, and it is the usual cause of this.`;

  // What kind of token is this?
  let isPageToken = false;
  try {
    const me = await graph("me", { fields: "id,name" });
    isPageToken = String(me.id) === String(PAGE_ID);
    checks.push({
      name: "Token is a Page token",
      ok: isPageToken,
      detail: isPageToken
        ? `Yes, a Page token for "${me.name}".`
        : `No. It identifies "${me.name}" (${me.id}), which is not the Page in META_PAGE_ID. ${wrongTokenAdvice}`,
    });
  } catch (err) {
    checks.push({ name: "Token is valid", ok: false, detail: clean(err) });
    return { canPull: false, summary: "Meta rejected the access token. " + clean(err), checks };
  }

  // Scopes and expiry, when the app id is available to mint an app token.
  await describeToken(checks);

  // The question that actually matters.
  try {
    const feed = await graph(`${PAGE_ID}/feed`, { fields: "id,message,created_time", limit: "3" });
    const n = (feed.data ?? []).length;
    checks.push({
      name: "Read the Page feed",
      ok: true,
      detail: n ? `Yes, ${n} recent post(s) returned.` : "Yes, the request succeeded, but the Page has no posts yet.",
    });
    await describeWebhook(checks);
    return {
      canPull: true,
      summary: n
        ? `Connected. Meta returned ${n} recent post(s), so listening can pull content and match keywords against it.`
        : "Connected and authorised, but this Page has no posts yet, so there is nothing to scan.",
      checks,
    };
  } catch (err) {
    checks.push({ name: "Read the Page feed", ok: false, detail: clean(err) });
    return {
      canPull: false,
      // When the token is not a Page token, that is the cause, and Meta's own
      // #10 error points at App Review instead, which wastes hours.
      summary: isPageToken
        ? "The token administers this Page but still cannot read its feed, which points at a missing pages_read_engagement scope. " + clean(err)
        : "This is a User token, not a Page token. " + wrongTokenAdvice,
      checks,
    };
  }
}

/** Report the token's type, scopes and expiry, if we can mint an app token. */
async function describeToken(checks: MetaDiagnosis["checks"]) {
  if (!APP_ID || !APP_SECRET) {
    checks.push({
      name: "Token scopes",
      ok: true,
      detail: "Not checked. Set META_APP_ID alongside META_APP_SECRET and this will list the token's scopes and expiry.",
    });
    return;
  }
  try {
    const res = await graph("debug_token", { input_token: TOKEN }, `${APP_ID}|${APP_SECRET}`);
    const d = res.data ?? {};
    const scopes: string[] = d.scopes ?? [];
    const canRead = scopes.includes("pages_read_engagement");
    checks.push({
      name: "pages_read_engagement",
      ok: canRead,
      detail: canRead
        ? "Granted."
        : `Missing. The token carries: ${scopes.join(", ") || "no scopes"}. Re-generate it with pages_read_engagement ticked.`,
    });

    // Expiry is worth surfacing loudly: a token minted from a short-lived user
    // token works today and mysteriously stops tomorrow.
    const exp = Number(d.expires_at ?? 0);
    if (!exp) {
      checks.push({ name: "Token expiry", ok: true, detail: "Never expires." });
    } else {
      const mins = Math.round((exp * 1000 - Date.now()) / 60000);
      checks.push({
        name: "Token expiry",
        ok: mins > 60 * 24,
        detail:
          mins <= 0
            ? "Already expired. Generate a new one."
            : `Expires in about ${mins < 120 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`}. ` +
              "Exchange the user token for a long-lived one, then take the Page token from me/accounts again, or this will stop working on its own.",
      });
    }
  } catch {
    // Not being able to inspect the token is not itself a failure.
  }
}

/** Is the Page subscribed to this app, so webhook events actually arrive? */
async function describeWebhook(checks: MetaDiagnosis["checks"]) {
  try {
    const res = await graph(`${PAGE_ID}/subscribed_apps`, {});
    const apps = res.data ?? [];
    const subscribed = APP_ID ? apps.some((a: { id?: string }) => String(a.id) === String(APP_ID)) : apps.length > 0;
    checks.push({
      name: "Webhook subscription",
      ok: subscribed,
      detail: subscribed
        ? "This Page is subscribed to the app, so live comment events will arrive."
        : "This Page is not subscribed to the app. Manual Sync works, but live events will not arrive until it is.",
    });
  } catch {
    // Requires pages_manage_metadata; its absence is not worth failing over.
  }
}

/**
 * Meta appends a paragraph of documentation URLs to its errors. Useful in a
 * terminal, useless in a status panel, and it buries the one sentence that
 * matters under two hundred characters of links.
 */
function clean(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/\s*Refer to https?:\/\/\S+.*$/i, "").trim();
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
