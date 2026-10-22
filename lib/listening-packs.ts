import { createAdminClient } from "@/lib/supabase/admin";
import { PRESETS, PRESET_BY_ID, type Preset } from "@/lib/listening-presets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

export interface PackState {
  id: Preset["id"];
  name: string;
  blurb: string;
  enabled: boolean;
  accounts: number;
  words: number;
}

/** Add a pack's accounts and words (skipping any already there) and tag them so the pack can switch them on and off. */
async function apply(preset: Preset) {
  for (const s of preset.sources) {
    const { data } = await db().from("listening_sources").select("id, pack").eq("platform", s.platform).eq("kind", s.kind).ilike("handle", s.handle).maybeSingle();
    if (!data) {
      await db().from("listening_sources").insert({ platform: s.platform, kind: s.kind, handle: s.handle, index_all: s.indexAll, pack: preset.id, active: true, note: `${preset.name} preset` });
    } else if (!data.pack) {
      // Already watched by hand: keep it, and mark it as part of the pack so the pack's switch governs it.
      await db().from("listening_sources").update({ pack: preset.id, index_all: s.indexAll }).eq("id", data.id);
    }
  }
  if (preset.keywords.length) {
    const { data: existing } = await db().from("listening_keywords").select("word");
    const have = new Set(((existing ?? []) as { word: string }[]).map((k) => k.word.toLowerCase()));
    const fresh = preset.keywords.filter((k) => !have.has(k.word.toLowerCase())).map((k) => ({ word: k.word, severity: k.severity, pack: preset.id }));
    if (fresh.length) await db().from("listening_keywords").insert(fresh);
  }
}

/**
 * Make sure every pack that is switched on has its accounts and words, and report
 * where each pack stands. Cheap on the usual path (one read); the work happens
 * only the first time, or when a pack has grown. Returns null before migration
 * 020 has been applied, so the page simply shows no packs.
 */
export async function ensurePacks(): Promise<PackState[] | null> {
  const { data: rows, error } = await db().from("listening_packs").select("id, enabled, version");
  if (error) return null;
  const known = new Map(((rows ?? []) as { id: string; enabled: boolean; version: number }[]).map((r) => [r.id, r]));

  for (const preset of PRESETS) {
    let row = known.get(preset.id);
    if (!row) {
      await db().from("listening_packs").insert({ id: preset.id, enabled: true });
      row = { id: preset.id, enabled: true, version: 0 };
    }
    if (row.enabled && row.version < preset.version) {
      await apply(preset);
      await db().from("listening_packs").update({ version: preset.version, applied_at: new Date().toISOString() }).eq("id", preset.id);
    }
  }

  const [{ data: after }, { data: srcs }, { data: kws }] = await Promise.all([
    db().from("listening_packs").select("id, enabled"),
    db().from("listening_sources").select("pack"),
    db().from("listening_keywords").select("pack"),
  ]);
  const enabled = new Map(((after ?? []) as { id: string; enabled: boolean }[]).map((r) => [r.id, r.enabled]));
  const count = (list: { pack: string | null }[] | null, id: string) => (list ?? []).filter((x) => x.pack === id).length;

  return PRESETS.map((p) => ({
    id: p.id, name: p.name, blurb: p.blurb,
    enabled: enabled.get(p.id) ?? true,
    accounts: count(srcs, p.id),
    words: count(kws, p.id),
  }));
}

/** Switch a pack on or off. Off pauses its accounts and mutes its words; nothing is deleted, and nothing captured is touched. */
export async function setPackEnabled(id: string, enabled: boolean): Promise<void> {
  const preset = PRESET_BY_ID[id as Preset["id"]];
  if (!preset) return;
  await db().from("listening_packs").upsert({ id, enabled }, { onConflict: "id" });
  if (enabled) await apply(preset);
  await db().from("listening_sources").update({ active: enabled }).eq("pack", id);
  await db().from("listening_keywords").update({ active: enabled }).eq("pack", id);
  if (enabled) await db().from("listening_packs").update({ version: preset.version, applied_at: new Date().toISOString() }).eq("id", id);
}
