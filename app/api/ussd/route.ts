import { createHash } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { alertOnReport } from "@/lib/alerts";
import { createAdminClient } from "@/lib/supabase/admin";
import { INCIDENT_TYPES, KENYA_COUNTIES, OTHER_COUNTRIES, countryOf } from "@/lib/reporting-options";

// Africa's Talking USSD webhook. AT posts: sessionId, serviceCode, phoneNumber,
// text (all prior inputs joined by "*"). The flow is positional on that array:
//   0 language | 1 menu (1 new report, 2 check a report)
//   new report:  2.. incident type (may span 2 pages) | explanation
//                | [platform if digital threats] | county or country
//                | help needed | PIN | confirm
//   check:       2 PIN
// We never re-prompt on bad input (that would shift every later index in a
// stateless webhook); instead we normalise inputs to valid values.

export const dynamic = "force-dynamic";

// USSD screens hold ~180 characters, so the 15 incident types are shown over
// two pages: 1-7 and "8. More", then the rest.
const PAGE1 = 7;
const MORE = "8";
const DIGITAL = "digital_threats";

const HELP_TYPES = ["", "legal", "medical", "psychosocial", "shelter", ""]; // 5 = just reporting
const HELP_LABELS: Record<"en" | "sw", string[]> = {
  en: ["", "Legal", "Medical", "Counselling", "Shelter", "Just reporting"],
  sw: ["", "Kisheria", "Matibabu", "Ushauri nasaha", "Hifadhi", "Naripoti tu"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const PLACE_LOOKUP = new Map([...KENYA_COUNTIES, ...OTHER_COUNTRIES].map((c) => [norm(c), c] as const));
PLACE_LOOKUP.set("drc", "DRC");
PLACE_LOOKUP.set("congo", "DRC");
PLACE_LOOKUP.set("drcongo", "DRC");
// An unmatched place is stored as typed - the fact-checker corrects it, cheaper
// than a re-prompt loop that would corrupt the positional state.
const matchPlace = (input: string) => PLACE_LOOKUP.get(norm(input)) ?? input.trim();

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

const MAX_PIN_TRIES = 5;
/** A short PIN is only as good as the lockout behind it; the phone number is mixed in so equal PINs differ. */
const hashPin = (pin: string, phone: string) =>
  createHash("sha256").update(`${pin}:${phone}:${process.env.USSD_PIN_PEPPER ?? ""}`).digest("hex");

const STATUS_TEXT: Record<"en" | "sw", Record<string, string>> = {
  en: {
    submitted: "Received. A person will review it soon.",
    under_review: "Being reviewed by our team.",
    referred: "Support has been arranged. We will contact you.",
    closed: "This report is closed.",
    flagged: "Flagged for urgent attention.",
  },
  sw: {
    submitted: "Imepokelewa. Mtu atakagua hivi karibuni.",
    under_review: "Inakaguliwa na timu yetu.",
    referred: "Msaada umepangwa. Tutakupigia.",
    closed: "Ripoti hii imefungwa.",
    flagged: "Imewekwa alama ya dharura.",
  },
};
const list = (from: number, to: number) =>
  INCIDENT_TYPES.slice(from, to).map((t, i) => `${i + 1}. ${t.label}`).join("\n");

const prompts = {
  lang: `CON WHRD Hub Safe Report / Ripoti Salama\n1. English\n2. Kiswahili`,
  menu: (l: string) => sw(l)
    ? `CON Unataka nini?\n1. Ripoti mpya\n2. Angalia ripoti yangu`
    : `CON What would you like to do?\n1. New report\n2. Check my report`,
  checkPin: (l: string) => sw(l) ? `CON Weka PIN yako ya tarakimu 4:` : `CON Enter your 4-digit PIN:`,
  setPin: (l: string) => sw(l)
    ? `CON Weka PIN ya tarakimu 4 ya kuangalia ripoti baadaye (au 0 kuruka):`
    : `CON Set a 4-digit PIN to check your report later (or 0 to skip):`,
  noReport: (l: string) => sw(l) ? `END Hakuna ripoti iliyo na PIN kwa nambari hii.` : `END No report with a PIN was found for this number.`,
  wrongPin: (l: string) => sw(l) ? `END PIN si sahihi. Jaribu tena.` : `END That PIN is not right. Try again.`,
  locked: (l: string) => sw(l) ? `END Majaribio mengi. Piga 1195 kwa msaada.` : `END Too many tries. Please call 1195 for help.`,
  status: (l: string, ref: string, status: string) => sw(l) ? `END Ripoti ${ref}:\n${status}\nDharura: 1195.` : `END Report ${ref}:\n${status}\nImmediate help: 1195.`,
  type1: (l: string) => `CON ${sw(l) ? "Aina ya tukio?" : "What type of incident?"}\n${list(0, PAGE1)}\n${MORE}. ${sw(l) ? "Zaidi" : "More"}`,
  type2: (l: string) => `CON ${sw(l) ? "Aina nyingine:" : "More types:"}\n${list(PAGE1, INCIDENT_TYPES.length)}`,
  explanation: (l: string) => sw(l) ? `CON Eleza kwa ufupi kilichotokea:` : `CON Briefly describe what happened:`,
  platform: (l: string) => sw(l) ? `CON Andika mtandao au bandika kiungo (mf. Facebook):` : `CON Enter the platform or paste the link (e.g. Facebook):`,
  place: (l: string) => sw(l)
    ? `CON Andika kaunti au nchi yako (mf. Kitui, Uganda):`
    : `CON Type your county or country (e.g. Kitui, Uganda):`,
  help: (l: string) => sw(l)
    ? `CON Unahitaji msaada gani?\n1. Kisheria\n2. Matibabu\n3. Ushauri nasaha\n4. Hifadhi\n5. Naripoti tu`
    : `CON What support do you need?\n1. Legal\n2. Medical\n3. Counselling\n4. Shelter\n5. Just reporting`,
  confirm: (l: string, s: string) => sw(l) ? `CON Thibitisha:\n${s}\n1. Wasilisha\n2. Ghairi` : `CON Confirm:\n${s}\n1. Submit\n2. Cancel`,
  submitted: (l: string, ref: string) => sw(l)
    ? `END Ripoti imepokelewa.\nKumb: ${ref}\nPiga tena, chagua 2 kuangalia. Dharura: 1195.`
    : `END Report received.\nRef: ${ref}\nDial again and choose 2 to check it. Help: 1195.`,
  cancelled: (l: string) => sw(l) ? `END Ripoti imeghairiwa. Piga 1195 kwa msaada.` : `END Report cancelled. Call 1195 for support.`,
  error: (l: string) => sw(l) ? `END Hitilafu imetokea. Jaribu tena au piga 1195.` : `END An error occurred. Please try again or call 1195.`,
};

// Africa's Talking expects plain text starting with CON or END, nothing else.
const reply = (text: string) => new NextResponse(text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });

/** AT sends form fields; accept JSON too so a test client or a proxy that re-encodes still works. */
async function readParams(req: NextRequest): Promise<URLSearchParams> {
  const raw = await req.text();
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const j = JSON.parse(raw) as Record<string, unknown>;
      return new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
    } catch { /* fall through to form parsing */ }
  }
  return new URLSearchParams(raw);
}

/** The status of the latest report this phone filed with the PIN given, with a lockout after too many wrong tries. */
async function checkReport(phone: string, pin: string, lang: string): Promise<string> {
  const admin = createAdminClient();
  const L = sw(lang) ? "sw" : "en";
  const { data } = await admin
    .from("reports")
    .select("id, status, ussd_pin_hash, ussd_pin_attempts")
    .eq("channel", "ussd")
    .eq("contact_value", phone)
    .not("ussd_pin_hash", "is", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  const rows = data ?? [];
  if (rows.length === 0) return prompts.noReport(lang);
  if (rows.some((r) => (r.ussd_pin_attempts ?? 0) >= MAX_PIN_TRIES)) return prompts.locked(lang);

  const ids = rows.map((r) => r.id as string);
  const hit = /^\d{4}$/.test(pin) ? rows.find((r) => r.ussd_pin_hash === hashPin(pin, phone)) : undefined;
  if (!hit) {
    const tries = Math.max(...rows.map((r) => r.ussd_pin_attempts ?? 0)) + 1;
    await admin.from("reports").update({ ussd_pin_attempts: tries }).in("id", ids);
    return tries >= MAX_PIN_TRIES ? prompts.locked(lang) : prompts.wrongPin(lang);
  }
  await admin.from("reports").update({ ussd_pin_attempts: 0 }).in("id", ids);
  const status = STATUS_TEXT[L][(hit.status as string) ?? "submitted"] ?? STATUS_TEXT[L].submitted;
  return prompts.status(lang, (hit.id as string).slice(0, 8).toUpperCase(), status);
}

export async function POST(req: NextRequest) {
  const params = await readParams(req);
  const sessionId = params.get("sessionId") || "";
  const phoneNumber = params.get("phoneNumber") || "";
  const text = params.get("text") || "";

  const inputs = text ? text.split("*") : [];
  const lang = inputs[0] || "1";
  const L = sw(lang) ? "sw" : "en";

  // Incident type: "8" on the first page means "show more", which shifts every later answer by one.
  let at = 2;
  const wentToPage2 = inputs[at] === MORE;
  if (wentToPage2) at++;
  const typeInput = parseInt(inputs[at]);
  const typeIdx = wentToPage2
    ? PAGE1 + ((typeInput > 0 ? typeInput : INCIDENT_TYPES.length - PAGE1) - 1)
    : (typeInput > 0 && typeInput <= PAGE1 ? typeInput : INCIDENT_TYPES.length) - 1;
  const incident = INCIDENT_TYPES[Math.min(Math.max(typeIdx, 0), INCIDENT_TYPES.length - 1)];
  const isOnline = incident.value === DIGITAL;

  // Where each later answer sits, now that we know how many steps came before.
  const explIdx = at + 1;
  const platformIdx = isOnline ? explIdx + 1 : -1;
  const placeIdx = (isOnline ? platformIdx : explIdx) + 1;
  const helpIdx = placeIdx + 1;
  const pinIdx = helpIdx + 1;
  const confirmIdx = pinIdx + 1;

  const explanation = inputs[explIdx] || "";
  const platformRaw = isOnline ? inputs[platformIdx] || "" : "";
  const place = matchPlace(inputs[placeIdx] || "");
  const helpChoice = parseInt(inputs[helpIdx]) || 5;
  // Four digits, or nothing (0 skips): a report with no PIN simply cannot be checked later.
  const pin = /^\d{4}$/.test(inputs[pinIdx] ?? "") ? inputs[pinIdx] : "";

  const summary = [
    incident.label,
    place,
    isOnline ? parsePlatform(platformRaw).platform : null,
    HELP_LABELS[L][helpChoice] || HELP_LABELS[L][5],
  ].filter(Boolean).join(" | ");

  const level = inputs.length;
  try {
    if (level === 0) return reply(prompts.lang);
    if (level === 1) return reply(prompts.menu(lang));

    // Check an earlier report with the PIN set when it was filed.
    if (inputs[1] === "2") {
      if (level === 2) return reply(prompts.checkPin(lang));
      return reply(await checkReport(phoneNumber, inputs[2] ?? "", lang));
    }

    if (level === 2) return reply(prompts.type1(lang));
    if (level === 3 && wentToPage2) return reply(prompts.type2(lang));
    if (level === at + 1) return reply(prompts.explanation(lang));
    if (level === explIdx + 1) return reply(isOnline ? prompts.platform(lang) : prompts.place(lang));
    if (isOnline && level === platformIdx + 1) return reply(prompts.place(lang));
    if (level === placeIdx + 1) return reply(prompts.help(lang));
    if (level === helpIdx + 1) return reply(prompts.setPin(lang));
    if (level === pinIdx + 1) return reply(prompts.confirm(lang, summary));

    if (level === confirmIdx + 1) {
      if (inputs[confirmIdx] !== "1") return reply(prompts.cancelled(lang));

      const admin = createAdminClient();
      const username = `ussd-${Math.random().toString(36).slice(2, 8)}`;
      const virtualEmail = `${username}@whrdhub.local`;
      const password = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 8);

      const { data: signupData, error: signupError } = await admin.auth.admin.createUser({
        email: virtualEmail, password, email_confirm: true,
        user_metadata: { username, is_anonymous: true, user_type: "reporter" },
      });
      if (signupError || !signupData.user) {
        console.error("USSD account creation error:", signupError);
        return reply(prompts.error(lang));
      }
      const userId = signupData.user.id;

      const { error: profileError } = await admin.from("profiles").upsert(
        { id: userId, username, is_anonymous: true, user_type: "reporter", email: virtualEmail },
        { onConflict: "id", ignoreDuplicates: false },
      );
      // The profile is a convenience; the report is what matters, so carry on.
      if (profileError) console.error("USSD profile upsert error:", profileError);

      const { platform, link } = parsePlatform(platformRaw);
      const support = HELP_TYPES[helpChoice] ? [HELP_TYPES[helpChoice]] : [];

      const row = {
        user_id: userId,
        incident_types: [incident.value],
        description: explanation,
        county: place || null,
        country: countryOf(place),
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
      };
      // Stored only when a PIN was set. If the follow-up columns are not there yet, file the report without them rather than lose it.
      const withPin = pin ? { ...row, ussd_pin_hash: hashPin(pin, phoneNumber) } : row;
      let { data: report, error: reportError } = await admin.from("reports").insert(withPin).select("id").single();
      if (reportError && pin && /ussd_pin/i.test(reportError.message)) {
        ({ data: report, error: reportError } = await admin.from("reports").insert(row).select("id").single());
      }
      if (reportError || !report) {
        console.error("USSD report insert error:", reportError);
        return reply(prompts.error(lang));
      }

      const { error: sessionError } = await admin.from("ussd_sessions").upsert({
        session_id: sessionId, phone_number: phoneNumber, text_input: text,
        current_step: "completed", report_id: report.id,
      }, { onConflict: "session_id" });
      // Only the confirmation SMS depends on this row; the report is already saved.
      if (sessionError) console.error("USSD session log error:", sessionError);

      // Critical kinds of abuse (a disappearance, a femicide) alert the team even from a feature phone.
      after(() => alertOnReport(report.id as string));

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

/** A browser or uptime check opening the URL: answer plainly instead of a 405, so it is clear the route is live. */
export async function GET() {
  return reply("END WHRD Hub USSD endpoint is live.");
}
