import { createAdminClient } from "@/lib/supabase/admin";
import { decideChoice } from "@/lib/decide";
import { KENYA_COUNTIES, OTHER_COUNTRIES } from "@/lib/reporting-options";

/**
 * From a capture to a case. An administrator who takes on something found by
 * online listening gets a normal report: the same page, fact-check, services,
 * timeline and audit trail as anything a person filed. It is marked as found
 * online (channel "api" is shown as "Online listening"), assigned to whoever took
 * it on, and linked both ways to the capture so neither is lost.
 *
 * Nobody reported it, so there is no reporter account and no contact detail.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createAdminClient() as any;

const PLATFORM: Record<string, string> = { instagram: "Instagram", x: "X", facebook: "Facebook" };

/** A short description of each kind of incident, for choosing the closest one. */
const TYPE_HINTS: Record<string, string> = {
  gbv: "Sexual or domestic violence, rape, beating or abuse of a woman or girl, or another form of gender-based violence.",
  police_brutality: "Violence, shooting, torture or unlawful arrest by police or other security forces.",
  corruption: "Bribery, theft of public money, abuse of office or extortion.",
  goonism: "Hired gangs or thugs used to intimidate, attack or silence people.",
  land_related: "Land grabbing, evictions or violence over land.",
  environment_related: "Threats or violence against people defending land, water or the environment.",
  digital_threats: "Online harassment, threats, doxxing, hacking or surveillance.",
  enforced_disappearance: "A person abducted, taken, missing or disappeared, including by the state.",
  human_trafficking: "People moved, held or sold against their will, including for labour or sex.",
  labor_related: "Unfair dismissal, unpaid wages, exploitation or abuse at work.",
  health_related: "Denial of or abuse in health care.",
  academic_related: "Abuse, harassment or pressure at school or university.",
  femicide: "A woman or girl killed because she is a woman, including killings by partners or relatives.",
  pedicide: "The killing of a child.",
  election_related: "Violence, intimidation or abuse linked to elections or political campaigns.",
};

async function incidentTypesFor(text: string, cls: string | null): Promise<string[]> {
  if (cls === "missing_person") return ["enforced_disappearance"];
  if (cls === "targeted_abuse") return ["digital_threats"];
  const lower = text.toLowerCase();
  if (/\bfemicide\b/.test(lower)) return ["femicide"];
  // Taking on has to feel instant, so the guess gets a couple of seconds at most; the case can be re-typed later.
  const r = await Promise.race([
    decideChoice(`A public social media post:\n${text.slice(0, 1500)}`, "Which kind of incident does this post describe? Choose the closest.", TYPE_HINTS),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ]);
  if (r && r.probability >= 0.4) return [r.choice];
  return ["gbv"];
}

/** The county (or other country) the post names, if it names one. */
function placeIn(text: string): { county: string | null; country: string | null } {
  for (const c of [...KENYA_COUNTIES].sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) return { county: c, country: "Kenya" };
  }
  for (const c of OTHER_COUNTRIES) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) return { county: c, country: c };
  }
  return { county: null, country: null };
}

export async function createCaseFromCapture(
  captureId: string,
  adminId: string,
): Promise<{ reportId: string; created: boolean } | { error: string }> {
  // report_id exists only once migration 021 is applied.
  let cap: Record<string, unknown> | null = null;
  for (const cols of ["id, source, permalink, author, content, severity, ai_class, report_id", "id, source, permalink, author, content, severity, ai_class"]) {
    const { data, error } = await db().from("listening_results").select(cols).eq("id", captureId).maybeSingle();
    if (!error) { cap = data; break; }
  }
  if (!cap) return { error: "That capture could not be found." };

  // Already taken on: go to the case that exists rather than making a second one.
  if (cap.report_id) {
    const { data: existing } = await db().from("reports").select("id").eq("id", cap.report_id).is("deleted_at", null).maybeSingle();
    if (existing) return { reportId: existing.id as string, created: false };
  }

  const content = (cap.content as string) ?? "";
  const types = await incidentTypesFor(content, (cap.ai_class as string | null) ?? null);
  const place = placeIn(content);
  const urgency = cap.severity === "high" ? "immediate" : cap.severity === "low" ? "no_rush" : "within_week";

  const row = {
    incident_types: types,
    description: content,
    tfgbv_platform: PLATFORM[cap.source as string] ?? (cap.source as string),
    tfgbv_link: cap.permalink ?? null,
    tfgbv_content_text: content,
    reporting_for: "someone_else",
    county: place.county,
    country: place.country,
    urgency,
    support_needed: [],
    consent_to_followup: false,
    is_ongoing: false,
    status: "under_review",
    verification_status: "pending",
    reporter_type: "anonymous",
    channel: "api",
    assigned_to: adminId,
  };

  // source_capture_id exists only once migration 021 is applied; without it the case is still created.
  let { data: report, error } = await db().from("reports").insert({ ...row, source_capture_id: captureId }).select("id").single();
  let linked = true;
  if (error && /source_capture_id/i.test(error.message)) {
    linked = false;
    ({ data: report, error } = await db().from("reports").insert(row).select("id").single());
  }
  if (error || !report) return { error: "Could not open a case from that capture just now." };

  const handled = { status: "reviewing", handled_by: adminId, handled_at: new Date().toISOString() };
  const link = linked ? { report_id: report.id } : {};
  let upd = await db().from("listening_results").update({ ...handled, ...link }).eq("id", captureId);
  if (upd.error) upd = await db().from("listening_results").update({ status: "reviewing" }).eq("id", captureId);

  await db().from("report_audit_log").insert({ report_id: report.id, viewed_by: adminId, action: "opened_from_listening", notes: `Taken on from online listening (${PLATFORM[cap.source as string] ?? cap.source})` });
  return { reportId: report.id as string, created: true };
}
