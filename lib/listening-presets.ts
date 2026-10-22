import { POLITICAL_HARASSMENT_KEYWORDS, type SeedKeyword } from "@/lib/political-harassment";

/**
 * Listening that is set up for you. A pack is a bundle of accounts to watch and
 * words to listen for, switched on by default and switchable off again without
 * losing anything already captured.
 *
 * Bump `version` when a pack gains accounts or words, and existing deployments
 * pick the additions up the next time the page is opened or the daily scan runs.
 */
export interface PresetSource {
  platform: "instagram" | "x" | "facebook";
  kind: "profile" | "hashtag";
  handle: string;
  /** Keep this account's posts as cases even when no watched word appears in them. */
  indexAll: boolean;
}

export interface Preset {
  id: "usikimye" | "political";
  name: string;
  blurb: string;
  version: number;
  sources: PresetSource[];
  keywords: SeedKeyword[];
}

export const PRESETS: Preset[] = [
  {
    id: "usikimye",
    name: "Usikimye",
    blurb: "Survivor stories and missing-person appeals shared by Usikimye on X. Every post is kept as a case, so nothing waits for a keyword to match.",
    version: 1,
    sources: [{ platform: "x", kind: "profile", handle: "usikimye", indexAll: true }],
    keywords: [],
  },
  {
    id: "political",
    name: "Political harassment",
    blurb: "Threats, smears, surveillance, arrests and pressure aimed at defenders, wherever they appear in the accounts you listen to.",
    version: 1,
    sources: [],
    keywords: POLITICAL_HARASSMENT_KEYWORDS,
  },
];

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p])) as Record<Preset["id"], Preset>;
