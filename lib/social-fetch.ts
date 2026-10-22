import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Public Instagram and X posts for online listening, read without logging in.
 * Adapted from Sauti Salama's social adapter and using the same keys: one link
 * in, a few plain fields out (who posted, what they wrote, where it lives).
 * Nothing else is asked for or kept.
 *
 *   Instagram  Meta's oEmbed when META_APP_ID and META_APP_SECRET are set,
 *              otherwise the Apify provider when APIFY_TOKEN is set
 *              (SOCIAL_ACTOR picks the actor, default apify/instagram-scraper).
 *   X          X's own public embed endpoint; no key.
 *
 * SOCIAL_PROVIDER=off switches every lookup off at once.
 */

export interface SocialPost {
  source: "instagram" | "x" | "facebook";
  /** Stable id used to avoid capturing the same post twice. */
  sourceId: string;
  url: string;
  author: string | null;
  text: string;
}

export type SocialStatus = "ok" | "off" | "unsupported" | "blocked" | "failed";
export interface SocialResult { status: SocialStatus; post: SocialPost | null; message: string }

const enabled = () => (process.env.SOCIAL_PROVIDER ?? "auto").toLowerCase() !== "off";
const hasOembed = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
const hasApify = () => !!process.env.APIFY_TOKEN;

/** True when at least one provider can read Instagram. X needs no key. */
export const instagramConfigured = () => enabled() && (hasOembed() || hasApify());
export const socialEnabled = () => enabled();

const trim = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, n) : null;

function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  );
}

async function assertPublic(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only web links can be read.");
  if (u.username || u.password) throw new Error("Links with a password are not fetched.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("That address is private.");
  return u;
}

/* ------------------------------------------------------------------ Instagram */

const IG_POST = /^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})\/?/;

export const isInstagramHost = (raw: string): boolean => {
  try { return /(^|\.)instagram\.com$/i.test(new URL(raw).hostname); } catch { return false; }
};

/** The one public post or reel a link points at, in its plain form. Profiles, stories and hashtags are not posts. */
export function instagramPostUrl(raw: string): { url: string; id: string } | null {
  try {
    const u = new URL(raw);
    if (!isInstagramHost(raw)) return null;
    const m = IG_POST.exec(u.pathname);
    if (!m) return null;
    return { url: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/`, id: m[2] };
  } catch { return null; }
}

async function igViaOembed(url: string, id: string): Promise<SocialPost | null> {
  const token = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  const res = await fetch(
    `https://graph.facebook.com/v21.0/instagram_oembed?${new URLSearchParams({ url, omitscript: "true", fields: "author_name,title" })}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { author_name?: string; title?: string };
  const text = trim(j.title, 2000);
  if (!text && !j.author_name) return null;
  return { source: "instagram", sourceId: id, url, author: trim(j.author_name, 80), text: text ?? "" };
}

async function apifyItems(input: Record<string, unknown>, actorName?: string): Promise<Record<string, unknown>[]> {
  const actor = (actorName ?? process.env.SOCIAL_ACTOR ?? "apify/instagram-scraper").replace("/", "~");
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=60&memory=512`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(70_000),
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  const items = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(items) ? items : [];
}

async function igViaApify(url: string, id: string): Promise<{ post: SocialPost | null; blocked: boolean }> {
  // One post only: none of its comments, none of its author's profile.
  const it = (await apifyItems({ directUrls: [url], resultsType: "posts", resultsLimit: 1, addParentData: false }))[0];
  if (!it || it.error || it.errorDescription) return { post: null, blocked: true };
  return {
    blocked: false,
    post: {
      source: "instagram", sourceId: id, url,
      author: trim(it.ownerUsername, 80) ?? trim(it.ownerFullName, 80),
      text: trim(it.caption, 2000) ?? "",
    },
  };
}

export async function instagramPost(raw: string): Promise<SocialResult> {
  const p = instagramPostUrl(raw);
  if (!p) return { status: "unsupported", post: null, message: "Only links to a single public Instagram post or reel can be read." };
  if (!instagramConfigured()) return { status: "off", post: null, message: "Instagram lookups are not available right now." };
  try {
    let post: SocialPost | null = null;
    let blocked = false;
    if (hasOembed()) post = await igViaOembed(p.url, p.id).catch(() => null);
    if (!post && hasApify()) ({ post, blocked } = await igViaApify(p.url, p.id));
    if (post) return { status: "ok", post, message: "" };
    return { status: "blocked", post: null, message: blocked ? "That post is private, removed or not public." : "Nothing could be read from that link." };
  } catch {
    return { status: "failed", post: null, message: "The Instagram lookup did not work just now. Try again." };
  }
}

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
export const validHandle = (h: string) => HANDLE.test(h);

/**
 * The latest public posts on a watched Instagram profile or hashtag. One
 * provider run per call, so callers keep the number of sources small. Only the
 * public caption and author are read.
 */
export async function recentInstagramPosts(kind: "profile" | "hashtag", handle: string, limit = 10): Promise<SocialPost[]> {
  if (!instagramConfigured() || !hasApify() || !HANDLE.test(handle)) return [];
  const url = kind === "hashtag" ? `https://www.instagram.com/explore/tags/${handle}/` : `https://www.instagram.com/${handle}/`;
  const items = await apifyItems({ directUrls: [url], resultsType: "posts", resultsLimit: Math.min(Math.max(limit, 1), 20), addParentData: false });
  const posts: SocialPost[] = [];
  for (const it of items) {
    if (it.error || it.errorDescription) continue;
    const id = trim(it.shortCode, 40) ?? trim(it.id, 40);
    const text = trim(it.caption, 2000);
    if (!id || !text) continue;
    posts.push({
      source: "instagram",
      sourceId: id,
      url: trim(it.url, 300) ?? `https://www.instagram.com/p/${id}/`,
      author: trim(it.ownerUsername, 80) ?? trim(it.ownerFullName, 80),
      text,
    });
  }
  return posts;
}

/**
 * The latest public posts from a watched X account or hashtag, through the same provider as Instagram.
 * One provider run per call. Only the public text and author are read.
 */
export async function recentXPosts(kind: "profile" | "hashtag", handle: string, limit = 10): Promise<SocialPost[]> {
  if (!enabled() || !hasApify() || !HANDLE.test(handle)) return [];
  const actor = process.env.SOCIAL_X_ACTOR ?? "apidojo/tweet-scraper";
  const items = await apifyItems(
    {
      ...(kind === "hashtag" ? { searchTerms: [`#${handle}`] } : { twitterHandles: [handle] }),
      maxItems: Math.min(Math.max(limit, 1), 20),
      sort: "Latest",
    },
    actor,
  );
  const posts: SocialPost[] = [];
  for (const it of items) {
    const id = trim(it.id, 40) ?? trim(it.id_str, 40);
    const text = trim(it.fullText, 2000) ?? trim(it.text, 2000);
    if (!id || !text) continue;
    const author = (it.author ?? it.user) as Record<string, unknown> | undefined;
    const name = trim(author?.userName, 40) ?? trim(author?.screen_name, 40);
    posts.push({
      source: "x",
      sourceId: id,
      url: trim(it.url, 300) ?? trim(it.twitterUrl, 300) ?? `https://x.com/i/status/${id}`,
      author: name ? `@${name}` : null,
      text,
    });
  }
  return posts;
}

/**
 * The latest public posts on a Facebook page. Meta only lets an app read pages it
 * administers, so a page we do not run is read through the same provider as
 * Instagram. One provider run per call; only the public text and page name are kept.
 */
export async function recentFacebookPosts(handle: string, limit = 10): Promise<SocialPost[]> {
  if (!enabled() || !hasApify() || !HANDLE.test(handle)) return [];
  const actor = process.env.SOCIAL_FB_ACTOR ?? "apify/facebook-posts-scraper";
  const items = await apifyItems(
    { startUrls: [{ url: `https://www.facebook.com/${handle}/` }], resultsLimit: Math.min(Math.max(limit, 1), 20) },
    actor,
  );
  const posts: SocialPost[] = [];
  for (const it of items) {
    if (it.error || it.errorDescription) continue;
    const id = trim(it.postId, 60) ?? trim(it.id, 60);
    const text = trim(it.text, 2000) ?? trim(it.message, 2000);
    if (!id || !text) continue;
    const user = it.user as Record<string, unknown> | undefined;
    posts.push({
      source: "facebook",
      sourceId: `fb-${id}`,
      url: trim(it.postUrl, 300) ?? trim(it.url, 300) ?? `https://www.facebook.com/${handle}/`,
      author: trim(it.pageName, 80) ?? trim(user?.name, 80),
      text,
    });
  }
  return posts;
}

/* ------------------------------------------------------------------ X */

const X_STATUS = /^\/(?:[A-Za-z0-9_]{1,15}|i|web)\/status(?:es)?\/(\d{5,25})/;

export const isXHost = (raw: string): boolean => {
  try { return /(^|\.)(x\.com|twitter\.com)$/i.test(new URL(raw).hostname); } catch { return false; }
};

export function xStatusUrl(raw: string): { url: string; id: string } | null {
  try {
    const u = new URL(raw);
    if (!isXHost(raw)) return null;
    const m = X_STATUS.exec(u.pathname);
    if (!m) return null;
    return { url: `https://x.com/${u.pathname.split("/")[1]}/status/${m[1]}`, id: m[1] };
  } catch { return null; }
}

const unentity = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

/** Where a t.co short link really goes, without opening the page. */
async function expandTco(href: string): Promise<string | null> {
  try {
    const u = await assertPublic(href);
    if (!/(^|\.)t\.co$/i.test(u.hostname)) return href;
    const res = await fetch(u, { redirect: "manual", headers: { "user-agent": "curl/8.5.0" }, signal: AbortSignal.timeout(6000) });
    const loc = res.headers.get("location");
    return loc ? new URL(loc, u).toString() : null;
  } catch { return null; }
}

export async function xPost(raw: string): Promise<SocialResult> {
  const p = xStatusUrl(raw);
  if (!p) return { status: "unsupported", post: null, message: "Only links to a single public post on X can be read." };
  if (!enabled()) return { status: "off", post: null, message: "Social lookups are paused." };
  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?${new URLSearchParams({ url: p.url, omit_script: "true", dnt: "true" })}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return { status: "blocked", post: null, message: "That post is private, removed or not public." };
    const j = (await res.json()) as { html?: string; author_name?: string; author_url?: string };
    const para = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(j.html ?? "")?.[1];
    if (!para) return { status: "blocked", post: null, message: "Nothing could be read from that link." };
    let body = para.replace(/<br\s*\/?>/gi, "\n");
    // X shortens links; write the real address into the text so keyword matching sees it.
    for (const a of [...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 6)) {
      const shown = unentity(a[2].replace(/<[^>]+>/g, "")).trim();
      if (/^pic\.(twitter|x)\.com/i.test(shown) || /^#|^@/.test(shown)) continue;
      const real = (await expandTco(unentity(a[1]))) ?? unentity(a[1]);
      if (/^https?:\/\//i.test(real) && !isXHost(real)) body = body.replace(a[0], ` ${real} `);
    }
    const text = unentity(body.replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
    const handle = /^\/?([A-Za-z0-9_]{1,15})/.exec(new URL(j.author_url ?? p.url).pathname)?.[1] ?? null;
    return { status: "ok", post: { source: "x", sourceId: p.id, url: p.url, author: handle ? `@${handle}` : trim(j.author_name, 80), text }, message: "" };
  } catch {
    return { status: "failed", post: null, message: "The X lookup did not work just now. Try again." };
  }
}

/** Read one link from either network. */
export async function readSocialLink(raw: string): Promise<SocialResult> {
  const link = raw.trim();
  if (isInstagramHost(link)) return instagramPost(link);
  if (isXHost(link)) return xPost(link);
  return { status: "unsupported", post: null, message: "Only Instagram and X links are supported." };
}
