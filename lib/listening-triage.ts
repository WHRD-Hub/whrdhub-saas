import { createAdminClient } from "@/lib/supabase/admin";
import { decideChoice, decideConfigured } from "@/lib/decide";

/**
 * Is a captured social post an actual case, or just a post that happens to
 * contain a watched word? Keywords find candidates; Jev decides which are worth
 * a person's time.
 *
 * It learns from the team. The posts people recently acted on and the ones they
 * dismissed are shown to Jev as worked examples alongside each new post, so the
 * line it draws moves towards where the team draws it, without any retraining.
 *
 * Only public posts are ever sent. Reporters' private reports are not (see
 * lib/decide.ts).
 */

export type PostClass = "real_incident" | "missing_person" | "targeted_abuse" | "awareness" | "not_relevant";

export const POST_CLASS_LABEL: Record<PostClass, string> = {
  real_incident: "Likely a real case",
  missing_person: "Missing person",
  targeted_abuse: "Abuse aimed at someone",
  awareness: "Awareness or news",
  not_relevant: "Likely not relevant",
};

const CRITERIA: Record<PostClass, string> = {
  real_incident:
    "The writer says abuse has happened or is happening to them or to someone specific they know: violence, threats, detention, sexual violence, stalking, online harassment. A response team could act on it.",
  missing_person:
    "Announces or appeals for a missing, abducted or disappeared person: usually a name, an age, a photo, where and when they were last seen, and a request for help finding them.",
  targeted_abuse:
    "The post is itself abuse: a threat, slur, smear, doxxing or harassment aimed at a woman, an activist or a human rights defender.",
  awareness:
    "News, commentary, campaigns, statistics, or general discussion about abuse or rights. Not about one specific case that needs a response.",
  not_relevant:
    "Not about abuse of people: figurative language, jokes, films or music, sport, advertising, or a word used in another sense.",
};

const QUESTION =
  "A watched keyword appeared in this public social media post. What kind of post is it? Judge the post, not the keyword. Posts may be in English, Kiswahili or Sheng.";

export interface Triage { cls: PostClass; confidence: number }

const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

/** The team's recent decisions, as worked examples. Empty until anyone has actioned or dismissed something. */
async function examples(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;
    const [acted, dismissed] = await Promise.all([
      db.from("listening_results").select("content").eq("status", "actioned").order("captured_at", { ascending: false }).limit(5),
      db.from("listening_results").select("content").eq("status", "dismissed").order("captured_at", { ascending: false }).limit(5),
    ]);
    const a = ((acted.data ?? []) as { content: string }[]).map((r) => `- ${clip(r.content, 220)}`);
    const d = ((dismissed.data ?? []) as { content: string }[]).map((r) => `- ${clip(r.content, 220)}`);
    if (!a.length && !d.length) return "";
    return [
      "How our team has judged similar posts before:",
      a.length ? `Acted on (real or abusive):\n${a.join("\n")}` : "",
      d.length ? `Dismissed (not worth acting on):\n${d.join("\n")}` : "",
      "",
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

/** Classify a batch of posts. Items Jev cannot answer for come back as null. */
export async function triagePosts(texts: string[]): Promise<(Triage | null)[]> {
  if (!decideConfigured() || texts.length === 0) return texts.map(() => null);
  const learned = await examples();
  const out: (Triage | null)[] = new Array(texts.length).fill(null);
  // A few at a time: fast enough, and kind to the API.
  for (let i = 0; i < texts.length; i += 2) {
    await Promise.all(
      texts.slice(i, i + 2).map(async (text, j) => {
        const r = await decideChoice<PostClass>(`${learned}Post:\n${clip(text, 1800)}`, QUESTION, CRITERIA);
        if (r) out[i + j] = { cls: r.choice, confidence: Math.round(r.probability * 100) / 100 };
      }),
    );
  }
  return out;
}

export const triageConfigured = decideConfigured;

/** Posts worth a person's time. */
export const isActionable = (t: Triage | null) =>
  !!t && (t.cls === "real_incident" || t.cls === "missing_person" || t.cls === "targeted_abuse") && t.confidence >= 0.6;
