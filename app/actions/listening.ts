"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireReportingAdmin } from "@/lib/reporting-access";
import { ingestItems } from "@/lib/listening";
import { readSocialLink, socialEnabled, validHandle } from "@/lib/social-fetch";
import { scanAll } from "@/lib/listening-sources";
import { setPackEnabled } from "@/lib/listening-packs";
import { createCaseFromCapture } from "@/lib/listening-case";
import { POLITICAL_HARASSMENT_KEYWORDS } from "@/lib/political-harassment";
import type { RawItem } from "@/lib/meta";

const MAX_LINKS_PER_SCAN = 10;

async function requireAdmin() {
  return await requireReportingAdmin();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export async function addKeyword(word: string, severity: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const w = word.trim();
  if (w.length < 2) return { error: "Keyword is too short." };
  const { error } = await db().from("listening_keywords").insert({ word: w, severity });
  if (error) return { error: error.message.includes("duplicate") ? "That keyword already exists." : error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function toggleKeyword(id: string, active: boolean) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_keywords").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function removeKeyword(id: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_keywords").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function setResultStatus(id: string, status: string) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Admins only." };
  if (!["new", "reviewing", "actioned", "dismissed"].includes(status)) return { error: "Unknown status." };
  // Remember who handled it, so colleagues sharing the inbox do not duplicate the work.
  const handled = status === "new" ? { handled_by: null, handled_at: null } : { handled_by: adminId, handled_at: new Date().toISOString() };
  let { error } = await db().from("listening_results").update({ status, ...handled }).eq("id", id);
  // Before migration 019 the columns do not exist: still save the status.
  if (error && /handled_/i.test(error.message)) ({ error } = await db().from("listening_results").update({ status }).eq("id", id));
  if (error) return { error: "Could not save that just now." };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

/**
 * Read the Instagram and X links an admin pastes, and run the posts through the
 * same keyword matching as everything else. Only the public text of the post is
 * kept; nothing about its comments, followers or the author's profile.
 */
export async function scanSocialLinks(input: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  if (!socialEnabled()) return { error: "Social lookups are paused right now." };
  const links = [...new Set(input.split(/[\s,]+/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l)))];
  if (!links.length) return { error: "Paste one or more Instagram or X post links." };
  if (links.length > MAX_LINKS_PER_SCAN) return { error: `Scan at most ${MAX_LINKS_PER_SCAN} links at a time.` };

  const items: RawItem[] = [];
  const problems: string[] = [];
  for (const link of links) {
    const r = await readSocialLink(link);
    if (r.post && r.post.text) {
      items.push({ source: r.post.source, source_id: r.post.sourceId, permalink: r.post.url, author: r.post.author, content: r.post.text });
    } else {
      problems.push(`${link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}: ${r.post ? "the post has no text" : r.message}`);
    }
  }
  try {
    // Posts someone hands over on purpose are always kept, whatever they say.
    const { stored, existing } = await ingestItems(items, { triage: true, index: "all" });
    revalidatePath("/hub/reporting/listening");
    return { ok: true, scanned: items.length, stored, existing, problems };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Scan failed." };
  }
}

/** Add the political-harassment vocabulary to the watch list (existing words are left alone). */
export async function seedPoliticalKeywords() {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { data: existing } = await db().from("listening_keywords").select("word");
  const have = new Set((existing ?? []).map((k: { word: string }) => k.word.toLowerCase()));
  const fresh = POLITICAL_HARASSMENT_KEYWORDS.filter((k) => !have.has(k.word.toLowerCase()));
  if (fresh.length) {
    const { error } = await db().from("listening_keywords").insert(fresh);
    if (error) return { error: error.message };
  }
  revalidatePath("/hub/reporting/listening");
  return { ok: true, added: fresh.length };
}

/* ── Watched Instagram accounts and hashtags ─────────────────────────────── */

/** Start listening to one or more accounts or hashtags (separate several with spaces, commas or new lines). */
export async function addSource(platform: "instagram" | "x" | "facebook", kind: "profile" | "hashtag", raw: string, note?: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const handles = raw
    .split(/[\s,]+/)
    .map((h) =>
      h.trim()
        .replace(/^[@#]/, "")
        .replace(/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com|facebook\.com)\/(explore\/tags\/|hashtag\/)?/i, "")
        .replace(/[/?].*$/, ""),
    )
    .filter(Boolean);
  if (handles.length === 0) return { error: "Type at least one account name or hashtag." };
  const bad = handles.find((h) => !validHandle(h));
  if (bad) return { error: `"${bad}" does not look like an account name or hashtag.` };

  // Facebook pages are watched as accounts only; hashtags are not supported there.
  const useKind = platform === "facebook" ? "profile" : kind;
  const rows = [...new Set(handles.map((h) => h.toLowerCase()))].map((handle) => ({
    platform, kind: useKind, handle, note: note?.trim() || null,
  }));
  // Re-adding an account that was paused turns it back on instead of failing as a duplicate.
  let existing: { id: string; handle: string }[] = [];
  const found = await db().from("listening_sources").select("id, handle").eq("platform", rows[0].platform).eq("kind", useKind).in("handle", rows.map((r) => r.handle));
  existing = (found.data ?? []) as { id: string; handle: string }[];
  const have = new Set(existing.map((e) => e.handle.toLowerCase()));
  if (existing.length) await db().from("listening_sources").update({ active: true }).in("id", existing.map((e) => e.id));
  const fresh = rows.filter((r) => !have.has(r.handle));
  if (fresh.length) {
    const { error } = await db().from("listening_sources").insert(fresh);
    if (error) return { error: "Could not save that just now." };
  }
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

/**
 * Stop listening to an account that turned up in a capture: it is kept on the
 * list, paused, so its posts are ignored from now on and can be switched back on later.
 */
export async function muteAccount(platform: string, author: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const plat = platform === "x" ? "x" : platform === "instagram" ? "instagram" : null;
  const handle = author.replace(/^@/, "").trim().toLowerCase();
  if (!plat || !validHandle(handle)) return { error: "That account cannot be muted from here." };
  const { data } = await db().from("listening_sources").select("id").eq("platform", plat).eq("kind", "profile").eq("handle", handle).maybeSingle();
  const { error } = data
    ? await db().from("listening_sources").update({ active: false }).eq("id", data.id)
    : await db().from("listening_sources").insert({ platform: plat, kind: "profile", handle, active: false, note: "Muted from a capture" });
  if (error) return { error: "Could not save that just now." };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function toggleSource(id: string, active: boolean) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_sources").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

export async function removeSource(id: string) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const { error } = await db().from("listening_sources").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

/** Scan every social source right now (the daily job does the same). */
export async function scanAllNow() {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const r = await scanAll();
  revalidatePath("/hub/reporting/listening");
  if (r.message) return { error: r.message };
  return { ok: true, scanned: r.read, stored: r.stored };
}

/** Switch a preset pack on or off. Off pauses its accounts and mutes its words; nothing captured is removed. */
export async function togglePack(id: string, enabled: boolean) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  await setPackEnabled(id, enabled);
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

/**
 * Take on a capture: it becomes a normal case (the same page, fact-check, services
 * and timeline as a report a person filed), assigned to the admin who took it on.
 * Taking on one that is already a case just returns that case.
 */
export async function takeOnCapture(id: string) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Admins only." };
  const r = await createCaseFromCapture(id, adminId);
  if ("error" in r) return { error: r.error };
  revalidatePath("/hub/reporting/listening");
  revalidatePath("/hub/reporting/reports");
  revalidatePath("/hub/reporting");
  return { ok: true, reportId: r.reportId };
}

/** Close or reopen several captures at once (for working through a stream). */
export async function setResultsStatus(ids: string[], status: string) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Admins only." };
  if (!["new", "reviewing", "actioned", "dismissed"].includes(status)) return { error: "Unknown status." };
  const list = [...new Set(ids)].slice(0, 200);
  if (list.length === 0) return { error: "Nothing selected." };
  const handled = status === "new" ? { handled_by: null, handled_at: null } : { handled_by: adminId, handled_at: new Date().toISOString() };
  let { error } = await db().from("listening_results").update({ status, ...handled }).in("id", list);
  if (error && /handled_/i.test(error.message)) ({ error } = await db().from("listening_results").update({ status }).in("id", list));
  if (error) return { error: "Could not save that just now." };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}

/** Listen to a hashtag that keeps appearing in captures: it joins the list on the chosen platforms. */
export async function acceptTagSuggestion(tag: string, platforms: ("instagram" | "x")[]) {
  if (!(await requireAdmin())) return { error: "Admins only." };
  const handle = tag.replace(/^#/, "").toLowerCase();
  if (!validHandle(handle)) return { error: "That does not look like a hashtag." };
  for (const platform of new Set(platforms)) {
    if (platform !== "instagram" && platform !== "x") continue;
    const r = await addSource(platform, "hashtag", handle, "Added from a tag that kept appearing in captures");
    if (r.error) return r;
  }
  return { ok: true };
}

/** Say no to a suggested hashtag; it is not offered again. */
export async function declineTagSuggestion(tag: string) {
  const adminId = await requireAdmin();
  if (!adminId) return { error: "Admins only." };
  const handle = tag.replace(/^#/, "").toLowerCase();
  if (!validHandle(handle)) return { error: "That does not look like a hashtag." };
  const { error } = await db().from("listening_tag_declines").upsert({ tag: handle, declined_by: adminId });
  if (error) return { error: /listening_tag_declines/i.test(error.message) ? "Run migration 022 so this choice can be remembered." : "Could not save that just now." };
  revalidatePath("/hub/reporting/listening");
  return { ok: true };
}
