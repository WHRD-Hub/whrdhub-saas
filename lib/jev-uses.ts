import { createHash } from "node:crypto";
import { decideChoice, decideConfigured, jevMayReadReports } from "@/lib/decide";
import { SUPPORT_TYPES } from "@/lib/reporting-options";

/**
 * Small, bounded uses of Jev beyond listening. Each returns null when Jev is
 * unavailable, and every page that uses one works the same without it.
 */

/* ── Moderation: what needs a second look before it reaches the public feed ── */

export type ReviewFlag = "identifies_person" | "threat_or_hate" | "sensitive_case" | "fine";

export const REVIEW_FLAG_LABEL: Record<Exclude<ReviewFlag, "fine">, string> = {
  identifies_person: "May identify a survivor or a child",
  threat_or_hate: "Threats, hate or incitement",
  sensitive_case: "Graphic or ongoing case",
};

const REVIEW_CRITERIA: Record<ReviewFlag, string> = {
  identifies_person:
    "Names, or gives enough detail to identify, a survivor, a child or a victim of abuse: a name together with a place, a phone number, an address, a school, or a description of their appearance.",
  threat_or_hate:
    "Contains threats, slurs, hate, or incitement against a person or a group.",
  sensitive_case:
    "Describes violence or abuse in graphic detail, or a specific ongoing case that may need the response team rather than the public feed.",
  fine: "An ordinary update, event notice, reflection or story. Nothing that needs extra care before publishing.",
};

const cache = new Map<string, { flag: ReviewFlag; p: number }>();

/** Flag pending posts and stories worth a second look. Anything Jev cannot judge is simply not flagged. */
export async function reviewFlags(items: { id: string; text: string }[]): Promise<Map<string, { flag: Exclude<ReviewFlag, "fine">; confidence: number }>> {
  const out = new Map<string, { flag: Exclude<ReviewFlag, "fine">; confidence: number }>();
  if (!decideConfigured()) return out;

  await Promise.all(
    items.slice(0, 15).map(async ({ id, text }) => {
      const body = text.replace(/\s+/g, " ").trim().slice(0, 3000);
      if (body.length < 12) return;
      const key = createHash("sha1").update(body).digest("hex");
      let hit = cache.get(key);
      if (!hit) {
        const r = await decideChoice<ReviewFlag>(
          `Content waiting for approval on a network for women human rights defenders:\n${body}`,
          "Does this need extra care before it is published to the public feed? Choose the closest answer.",
          REVIEW_CRITERIA,
        );
        if (!r) return;
        hit = { flag: r.choice, p: r.probability };
        cache.set(key, hit);
      }
      if (hit.flag !== "fine" && hit.p >= 0.6) out.set(id, { flag: hit.flag, confidence: hit.p });
    }),
  );
  return out;
}

/* ── Support: which service category a free-text "Other" request belongs to ── */

const SUPPORT_CRITERIA: Record<string, string> = {
  legal: "Wants a lawyer, legal advice, help with police, court, papers, land or a complaint.",
  medical: "Wants a doctor, treatment, medicine, a clinic, injuries seen to, or post-rape care.",
  psychosocial: "Wants counselling, someone to talk to, emotional support or help with trauma and stress.",
  digital_security: "Wants help securing a phone, accounts or devices, or dealing with hacking, spyware or online abuse.",
  shelter: "Wants a safe place to stay, relocation or somewhere to hide.",
  financial: "Wants money, emergency funds, rent, transport costs, school fees or help to restart a livelihood.",
  none: "Does not fit any of these, or is unclear.",
};

export interface SupportSuggestion { category: string; label: string; confidence: number }

/**
 * Suggest the category of a reporter's own words about the support they need.
 * Private text, so only sent when the deployment has opted in (JEV_PRIVATE_REPORTS=on).
 * It only suggests; an administrator still decides.
 */
export async function suggestSupportCategory(text: string): Promise<SupportSuggestion | null> {
  if (!jevMayReadReports() || text.trim().length < 6) return null;
  const r = await decideChoice(
    `Someone who reported abuse describes the support they need:\n${text.slice(0, 1500)}`,
    "Which kind of support service does this request fit best?",
    SUPPORT_CRITERIA,
  );
  if (!r || r.choice === "none" || r.probability < 0.55) return null;
  const label = SUPPORT_TYPES.find((s) => s.value === r.choice)?.label ?? r.choice;
  return { category: r.choice, label, confidence: Math.round(r.probability * 100) / 100 };
}
