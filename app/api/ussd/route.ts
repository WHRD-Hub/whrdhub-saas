import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Africa's Talking USSD webhook. AT posts: sessionId, serviceCode, phoneNumber,
// text (all prior inputs joined by "*"). Flow is positional on that array:
//   0 language | 1 incident type | 2 explanation | [3 platform if online]
//   | county | help needed | confirm
// We never re-prompt on bad input (that would shift every later index in a
// stateless webhook); instead we normalise inputs to valid values.

const INCIDENT_TYPES = ["", "physical_violence", "online_harassment", "sexual_violence", "workplace_abuse", "other"];
const HELP_TYPES = ["", "legal", "medical", "psychosocial", "shelter", ""]; // 5 = just reporting

const TYPE_LABELS: Record<"en" | "sw", string[]> = {
  en: ["", "Physical violence", "Online harassment", "Sexual violence", "Workplace abuse", "Other"],
  sw: ["", "Unyanyasaji wa kimwili", "Unyanyasaji mtandaoni", "Unyanyasaji wa kingono", "Unyanyasaji kazini", "Nyingine"],
};
const HELP_LABELS: Record<"en" | "sw", string[]> = {
  en: ["", "Legal", "Medical", "Counselling", "Shelter", "Just reporting"],
  sw: ["", "Kisheria", "Matibabu", "Ushauri nasaha", "Hifadhi", "Naripoti tu"],
};

const COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet", "Embu", "Garissa", "Homa Bay",
  "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu",
  "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru",
  "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi", "Trans Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const COUNTY_LOOKUP = new Map(COUNTIES.map((c) => [norm(c), c] as const));
// ponytail: unmatched county is stored as typed - the fact-checker corrects it,
// cheaper than a re-prompt loop that would corrupt the positional state.
const matchCounty = (input: string) => COUNTY_LOOKUP.get(norm(input)) ?? input.trim();

const PLATFORMS: Record<string, string> = {
  facebook: "Facebook", "fb.com": "Facebook", "fb.watch": "Facebook",
  twitter: "X (Twitter)", "x.com": "X (Twitter)", "t.co": "X (Twitter)",
  instagram: "Instagram", "instagr.am": "Instagram", tiktok: "TikTok",
  whatsapp: "WhatsApp", "wa.me": "WhatsApp", telegram: "Telegram", "t.me": "Telegram",
  youtube: "YouTube", "youtu.be": "YouTube", linkedin: "LinkedIn", snapchat: "Snapchat",
};
function parsePlatform(input: string): { platform: string; link: string | null } {
  const t = input.trim();
  const lower = t.toLowerCase();
  const key = Object.keys(PLATFORMS).find((k) => lower.includes(k));
  const isLink = lower.includes("http") || /\w+\.\w{2,}/.test(lower);
  return { platform: key ? PLATFORMS[key] : isLink ? "Unknown" : t, link: isLink ? t : null };
}

const sw = (lang: string) => lang === "2";
const prompts = {
  lang: `CON WHRD Hub Safe Report / Ripoti Salama\n1. English\n2. Kiswahili`,
  type: (l: string) => sw(l)
    ? `CON Aina ya tukio?\n1. Unyanyasaji wa kimwili\n2. Unyanyasaji mtandaoni\n3. Unyanyasaji wa kingono\n4. Unyanyasaji kazini\n5. Nyingine`
    : `CON What type of incident?\n1. Physical violence\n2. Online harassment\n3. Sexual violence\n4. Workplace abuse\n5. Other`,
  explanation: (l: string) => sw(l) ? `CON Eleza kwa ufupi kilichotokea:` : `CON Briefly describe what happened:`,
  platform: (l: string) => sw(l) ? `CON Andika mtandao au bandika kiungo (mf. Facebook):` : `CON Enter the platform or paste the link (e.g. Facebook):`,
  county: (l: string) => sw(l) ? `CON Andika jina la kaunti yako (mf. Kitui):` : `CON Type your county name (e.g. Kitui):`,
  help: (l: string) => sw(l)
    ? `CON Unahitaji msaada gani?\n1. Kisheria\n2. Matibabu\n3. Ushauri nasaha\n4. Hifadhi\n5. Naripoti tu`
    : `CON What support do you need?\n1. Legal\n2. Medical\n3. Counselling\n4. Shelter\n5. Just reporting`,
  confirm: (l: string, s: string) => sw(l) ? `CON Thibitisha:\n${s}\n1. Wasilisha\n2. Ghairi` : `CON Confirm:\n${s}\n1. Submit\n2. Cancel`,
  submitted: (l: string, ref: string) => sw(l)
    ? `END Ripoti imepokelewa.\nKumb: ${ref}\nTutafuatilia. Dharura: piga 1195.`
    : `END Report received.\nRef: ${ref}\nWe will follow up. Immediate help: call 1195.`,
  cancelled: (l: string) => sw(l) ? `END Ripoti imeghairiwa. Piga 1195 kwa msaada.` : `END Report cancelled. Call 1195 for support.`,
  error: (l: string) => sw(l) ? `END Hitilafu imetokea. Jaribu tena au piga 1195.` : `END An error occurred. Please try again or call 1195.`,
};

const reply = (text: string) => new NextResponse(text, { headers: { "Content-Type": "text/plain" } });

export async function POST(req: NextRequest) {
  const params = new URLSearchParams(await req.text());
  const sessionId = params.get("sessionId") || "";
  const phoneNumber = params.get("phoneNumber") || "";
  const text = params.get("text") || "";

  const inputs = text ? text.split("*") : [];
  const level = inputs.length;
  const lang = inputs[0] || "1";
  const isOnline = inputs[1] === "2";
  const L = sw(lang) ? "sw" : "en";

  // Collected answers (indices shift by 1 after the explanation when online).
  const typeChoice = parseInt(inputs[1]) || 5;
  const explanation = inputs[2] || "";
  const platformRaw = isOnline ? inputs[3] || "" : "";
  const county = matchCounty(inputs[isOnline ? 4 : 3] || "");
  const helpChoice = parseInt(inputs[isOnline ? 5 : 4]) || 5;
  const confirmIdx = isOnline ? 6 : 5;

  const summary = [
    TYPE_LABELS[L][typeChoice] || TYPE_LABELS[L][5],
    county,
    isOnline ? parsePlatform(platformRaw).platform : null,
    HELP_LABELS[L][helpChoice] || HELP_LABELS[L][5],
  ].filter(Boolean).join(" | ");

  try {
    if (level === 0) return reply(prompts.lang);
    if (level === 1) return reply(prompts.type(lang));
    if (level === 2) return reply(prompts.explanation(lang));
    if (level === 3) return reply(isOnline ? prompts.platform(lang) : prompts.county(lang));
    if (level === 4) return reply(isOnline ? prompts.county(lang) : prompts.help(lang));
    if (level === 5) return reply(isOnline ? prompts.help(lang) : prompts.confirm(lang, summary));
    if (level === 6 && isOnline) return reply(prompts.confirm(lang, summary));

    if (level === confirmIdx + 1) {
      if (inputs[confirmIdx] !== "1") return reply(prompts.cancelled(lang));

      const admin = createAdminClient();
      const username = `ussd-${Math.random().toString(36).slice(2, 8)}`;
      const virtualEmail = `${username}@whrdhub.local`;
      const password = Math.random().toString(36).slice(2, 14);

      const { data: signupData, error: signupError } = await admin.auth.admin.createUser({
        email: virtualEmail, password, email_confirm: true,
        user_metadata: { username, is_anonymous: true, user_type: "reporter" },
      });
      if (signupError || !signupData.user) {
        console.error("USSD account creation error:", signupError);
        return reply(prompts.error(lang));
      }
      const userId = signupData.user.id;

      await admin.from("profiles").upsert(
        { id: userId, username, is_anonymous: true, user_type: "reporter", email: virtualEmail },
        { onConflict: "id", ignoreDuplicates: false },
      );

      const { platform, link } = parsePlatform(platformRaw);
      const support = HELP_TYPES[helpChoice] ? [HELP_TYPES[helpChoice]] : [];

      const { data: report, error: reportError } = await admin.from("reports").insert({
        user_id: userId,
        incident_types: [INCIDENT_TYPES[typeChoice] || "other"],
        description: explanation,
        county,
        support_needed: support,
        reporting_for: "self",
        is_ongoing: false,
        consent_to_followup: true,
        contact_method: "phone",
        contact_value: phoneNumber, // full number - visible to the fact-checker
        tfgbv_platform: isOnline ? platform : null,
        tfgbv_link: isOnline ? link : null,
        status: "submitted",
        verification_status: "pending",
        reporter_type: "anonymous",
        channel: "ussd",
      }).select("id").single();
      if (reportError || !report) {
        console.error("USSD report insert error:", reportError);
        return reply(prompts.error(lang));
      }

      await admin.from("ussd_sessions").insert({
        session_id: sessionId, phone_number: phoneNumber, text_input: text,
        current_step: "completed", report_id: report.id,
      });

      // The confirmation SMS is sent by the events callback (/api/ussd/events)
      // when AT notifies us the session has ended - keeps SMS off this path.
      const ref = report.id.slice(0, 8).toUpperCase();
      return reply(prompts.submitted(lang, ref));
    }

    return reply(prompts.error(lang));
  } catch (err) {
    console.error("USSD error:", err);
    return reply(prompts.error(lang));
  }
}
