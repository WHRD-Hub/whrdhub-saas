/**
 * What each kind of abuse asks of us.
 *
 * One table drives two things: the safety plan a reporter is shown (what to do
 * for their own safety, shaped by what happened to them) and how urgently the
 * response team is alerted (a disappearance or a femicide is not triaged like
 * a corruption complaint). Keeping both here means they cannot drift apart.
 *
 * The advice is deliberately practical and low-risk: nothing here asks someone
 * to confront a perpetrator or do anything that could escalate danger.
 */

export interface PlanStep { id: string; text: string }
export interface PlanSection { title: string; steps: PlanStep[] }
export interface SafetyContact { name: string; number?: string; note: string }

interface Profile {
  /** Alert the response team at once, whatever the reporter ticked for urgency. */
  critical: boolean;
  /** One line shown above the plan. */
  headline: string;
  now: string[];
  people: string[];
  later: string[];
  digital?: string[];
  /** Numbers that matter for this kind of abuse. */
  contacts?: string[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const step = (prefix: string) => (text: string): PlanStep => ({ id: `${prefix}:${slug(text)}`, text });

/** Numbers we are sure of. Anything else is named without a number: the Hub gives the current one on request. */
export const CONTACTS: Record<string, SafetyContact> = {
  emergency: { name: "Police and emergency", number: "999", note: "Or 112 from any mobile. Free." },
  gbv: { name: "GBV helpline (Kenya)", number: "1195", note: "Free, 24 hours, confidential." },
  child: { name: "Childline Kenya", number: "116", note: "Free, 24 hours. For any child in danger." },
  redcross: { name: "Kenya Red Cross", number: "1199", note: "Emergency and psychosocial support." },
  hub: { name: "WHRD Hub response team", note: "Reply through your report, or ask for a call back there." },
  ipoa: { name: "Independent Policing Oversight Authority (IPOA)", note: "Complaints about police conduct. Ask the Hub for the current line." },
  knchr: { name: "Kenya National Commission on Human Rights", note: "Rights violations and disappearances. Ask the Hub for the current line." },
  eacc: { name: "Ethics and Anti-Corruption Commission (EACC)", note: "Corruption reports. Ask the Hub for the current line." },
  iebc: { name: "IEBC and the Office of the Director of Public Prosecutions", note: "Election offences. Ask the Hub for the current line." },
};

const GENERAL = {
  now: [
    "Decide where you will go if you need to leave in a hurry, and how you would get there.",
    "Keep your phone charged and some airtime or data in reserve.",
    "Tell one person you trust what is going on, and agree a word that means \"I need help\".",
  ],
  people: [
    "Write down two or three people you can call at any hour, and keep their numbers somewhere other than only your phone.",
    "Keep a copy of your ID and any important papers with someone you trust.",
  ],
  later: [
    "Keep a private record of what happens: dates, times, places, screenshots. Store it somewhere the person harming you cannot reach.",
    "Look after yourself: sleep, food, and time with people who are safe. Support is available whenever you want it.",
  ],
};

const PROFILES: Record<string, Profile> = {
  gbv: {
    critical: false,
    headline: "Your safety comes first. You do not have to decide anything today.",
    now: [
      "If you are in danger right now, go to a neighbour, a relative or a public place, then call 999 or 1195.",
      "Keep your phone and a small bag (ID, money, medicine, keys) where you can reach them quickly.",
    ],
    people: ["Tell a trusted neighbour or relative a signal that means you need them to call for help."],
    later: [
      "If you were hurt or assaulted, health care within 72 hours matters most. Free GBV services are available at many county hospitals.",
      "Keep any clothing, messages or photos, and do not wash away evidence until you have decided what you want to do.",
    ],
    contacts: ["gbv", "emergency"],
  },
  police_brutality: {
    critical: false,
    headline: "Being hurt by police is not your fault, and it can be recorded safely.",
    now: [
      "Move away from the place if you can do so safely, and get to someone you trust.",
      "If you are injured, get medical care and ask for a record of your injuries (a P3 form).",
    ],
    people: ["Tell a lawyer, a paralegal or the Hub before you speak to anyone about what happened."],
    later: [
      "Write down badge or vehicle numbers, the station, the time and who saw it. Photos of injuries help, with the date.",
      "Complaints about police conduct can be made to IPOA. The Hub can help you do this.",
    ],
    contacts: ["ipoa", "knchr", "emergency"],
  },
  corruption: {
    critical: false,
    headline: "Speaking up about corruption can bring pressure. Protect yourself first.",
    now: ["Do not discuss what you know on calls or messages you think might be monitored. Meet in person where you can."],
    people: ["Tell one trusted colleague or lawyer what you have reported, so you are not alone if there is pushback."],
    later: [
      "Keep copies of documents somewhere safe and separate, never only on your work phone or computer.",
      "Reports can also go to the EACC. The Hub can help you decide what to share and when.",
    ],
    digital: ["Use a personal device and account, not one your employer or the person involved controls."],
    contacts: ["eacc", "knchr"],
  },
  goonism: {
    critical: false,
    headline: "Hired gangs are meant to frighten you into silence. You are not alone.",
    now: [
      "Avoid being alone at the places and times you are usually found. Vary your routes and routine for now.",
      "If you are followed or threatened, go to a busy, lit public place and call someone you trust.",
    ],
    people: ["Let two trusted people know your movements each day until things settle."],
    later: ["Note vehicle plates, descriptions and any messages. Do not confront anyone."],
    contacts: ["emergency", "knchr"],
  },
  land_related: {
    critical: false,
    headline: "Land disputes can turn dangerous quickly. Keep your papers and your people close.",
    now: ["Do not go to the disputed land alone, and avoid confrontation with those claiming it."],
    people: ["Keep your title, lease or ownership papers with a trusted person, with copies elsewhere."],
    later: ["A land lawyer or paralegal can check the papers. The Hub can connect you."],
    contacts: ["knchr", "emergency"],
  },
  environment_related: {
    critical: false,
    headline: "Defending land and water is dangerous work. Plan around the people who would stop you.",
    now: ["Avoid travelling alone to sites, and tell someone where you are going and when you will be back."],
    people: ["Agree a check-in with your group. If someone does not check in, you know who will raise the alarm."],
    later: ["Document damage with dated photos from a safe distance, and store them off your phone too."],
    digital: ["Turn off location sharing in photos and messages before sending anything about a site."],
    contacts: ["knchr", "emergency"],
  },
  digital_threats: {
    critical: false,
    headline: "Most online abuse can be limited. Start with your accounts, then the evidence.",
    now: ["Do not reply to the person harassing you. Replying often makes it worse."],
    people: ["Tell a friend you trust what is happening so you are not carrying it alone."],
    later: ["Report the content to the platform after you have saved it. The Hub can help with reports that need follow-up."],
    digital: [
      "Change the password on any account that was attacked, and use a different one for each account.",
      "Turn on two-step verification (an app or SMS code) for email, social media and mobile money.",
      "Take screenshots with the date and the account name visible before anything is deleted.",
      "Check which devices are logged in to your accounts and sign out any you do not know.",
    ],
    contacts: ["hub"],
  },
  enforced_disappearance: {
    critical: true,
    headline: "A disappearance is an emergency. The response team has been alerted.",
    now: [
      "Tell people who can act right away: a lawyer, family, the Hub. Do it in person or by a channel you trust.",
      "If you are the person at risk, avoid your usual routes and routine, and keep someone updated on where you are.",
    ],
    people: [
      "Agree a check-in time with at least two people. If you miss it, they know to raise the alarm immediately.",
      "Make sure someone you trust has a recent photo and the details of the person missing.",
    ],
    later: ["Habeas corpus applications and complaints to the human rights commission can be made. A lawyer can start these today."],
    contacts: ["knchr", "emergency", "hub"],
  },
  human_trafficking: {
    critical: true,
    headline: "If someone is being held or moved against their will, this is an emergency.",
    now: [
      "If there is immediate danger, call 999 or 112. If you cannot speak, the call can still be traced.",
      "Do not confront the people involved. Keep your documents, and do not hand over passports or IDs.",
    ],
    people: ["Tell one safe person where you are and who you are with, using a way the traffickers cannot read."],
    later: ["Support for survivors of trafficking includes shelter, medical care and legal help. The Hub can connect you."],
    digital: ["Do not use a phone or account the traffickers gave you. If you must, assume they can read it."],
    contacts: ["emergency", "child", "gbv", "hub"],
  },
  labor_related: {
    critical: false,
    headline: "You have rights at work, even when it does not feel like it.",
    now: ["Do not sign anything you do not understand, or that withdraws your complaint."],
    people: ["Talk to a union representative, a paralegal or the Hub before the next meeting with your employer."],
    later: ["Keep contracts, payslips, messages and records of hours or unpaid work, in a place your employer cannot reach."],
    contacts: ["knchr"],
  },
  health_related: {
    critical: false,
    headline: "Your health and dignity matter. Care should not depend on who you are.",
    now: ["If you need urgent care, go to the nearest facility and say clearly what you need."],
    people: ["Bring someone with you to appointments if you can, and ask for the plan in writing."],
    later: ["Keep copies of records, receipts and the names of those who treated you."],
    contacts: ["redcross"],
  },
  academic_related: {
    critical: false,
    headline: "Pressure at school or university can be challenged. You do not have to face it alone.",
    now: ["Avoid being alone with the person pressuring you. Choose public places and bring a friend to meetings."],
    people: ["Tell a trusted lecturer, counsellor or student leader, and the Hub if you want help escalating."],
    later: ["Keep messages, grades, emails and the dates of incidents. Most institutions have a formal complaints process."],
    contacts: ["gbv", "hub"],
  },
  femicide: {
    critical: true,
    headline: "A woman has been killed or is at grave risk. The response team has been alerted.",
    now: [
      "If you or someone else is in danger now, call 999 or 112 and move to a safe place.",
      "If someone close to you was harmed, take care of yourself too: grief and fear are real, and help is here.",
    ],
    people: [
      "If the person responsible is known, tell trusted people and the Hub, and avoid being alone with them or their associates.",
      "Women in the same family or circle may also be at risk. Make sure they know to take care.",
    ],
    later: ["The Hub can help with the police report, a lawyer, and support for the family. Take things one step at a time."],
    contacts: ["emergency", "gbv", "hub"],
  },
  pedicide: {
    critical: true,
    headline: "A child has been killed or is at grave risk. The response team has been alerted.",
    now: [
      "If any child is in danger now, call 999 or 112, or Childline on 116.",
      "Keep other children close and with people you trust until you know they are safe.",
    ],
    people: ["Tell a trusted adult, a teacher or a chief about the danger so that more people are watching."],
    later: ["A child protection officer, the police and the Hub can work together. You do not have to carry this alone."],
    contacts: ["child", "emergency", "redcross", "hub"],
  },
  election_related: {
    critical: false,
    headline: "Election violence and intimidation are crimes. You can be heard and protected.",
    now: ["Avoid rallies and gatherings where you feel unsafe, and stay with others when you are out."],
    people: ["Let a trusted person know your movements on voting and results days."],
    later: ["Write down what you saw: where, when, who. Election offences can be reported to the IEBC and the police."],
    digital: ["Be careful what you post from the scene. Photos can show who and where you are."],
    contacts: ["iebc", "knchr", "emergency"],
  },
};

/** Extra steps for the specific risks a reporter says they face. */
const RISK_STEPS: Record<string, { section: "now" | "digital" | "people" | "later"; text: string }[]> = {
  direct_violence_assassination: [{ section: "now", text: "Vary your daily routine and routes, and avoid sleeping in the same place every night if you can." }],
  intimidation_threats: [{ section: "people", text: "Keep a record of every threat: who, when, how. Share it with someone you trust." }],
  sexual_violence: [{ section: "later", text: "Health care as soon as possible, ideally within 72 hours, can prevent infection and pregnancy. It is free at GBV centres." }],
  rape: [{ section: "later", text: "Please seek health care as soon as you can, ideally within 72 hours, and avoid washing if you plan to report. You decide what happens next." }],
  cyberbullying: [{ section: "digital", text: "Mute or block the accounts, and ask a friend to watch your messages for a few days so you do not have to read them." }],
  gendered_disinformation: [{ section: "digital", text: "Do not argue with false claims. Save them, report them, and ask the Hub for help correcting the record." }],
  arbitrary_detention: [{ section: "people", text: "Keep a lawyer's number memorised, and tell a trusted person to call them at once if you do not check in." }],
  criminalization_activism: [{ section: "later", text: "Speak to a lawyer before any summons, interview or statement. You are entitled to one." }],
  spurious_lawsuits: [{ section: "later", text: "Do not ignore court papers. Take them to a lawyer or the Hub quickly, because deadlines are short." }],
  spyware: [
    { section: "digital", text: "If you suspect spyware, do not tell people on that phone. Use a different, clean device to ask for help." },
    { section: "digital", text: "Keep your phone updated and remove apps you do not recognise. A factory reset on a clean backup can help." },
  ],
  digital_tracking: [{ section: "digital", text: "Turn off location sharing on your phone and social media, and check for unknown trackers in bags, vehicles and belongings." }],
  communications_interception: [{ section: "digital", text: "Use an end-to-end encrypted messenger for sensitive talk, and talk in person about the most sensitive things." }],
  digital_attacks: [{ section: "digital", text: "Change passwords from a clean device, turn on two-step verification, and review which devices are logged in." }],
  doxxing: [
    { section: "digital", text: "Tighten privacy settings on every account and ask platforms to remove posts that share your address or phone number." },
    { section: "people", text: "Tell your neighbours and family so they know to be careful about strangers asking about you." },
  ],
  public_defamation: [{ section: "later", text: "Save every false statement with its date and where it appeared. The Hub can help with a correction or legal response." }],
  social_ostracization: [{ section: "people", text: "Reach out to one or two people who still support you. Isolation is part of the harm, and connection helps." }],
  community_hostility: [{ section: "people", text: "Avoid being alone in places where hostility is high, and have a trusted person know where you are." }],
  betrayal_local_networks: [{ section: "people", text: "Share sensitive information only with people you have good reason to trust, and only what they need." }],
  psychological_stress: [{ section: "later", text: "Small routines help: regular sleep, a short walk, a call with someone safe. Counselling is available through the Hub." }],
  secondary_trauma: [{ section: "later", text: "If supporting others is wearing you down, step back for a while. Rest is part of the work." }],
  mental_health_struggles: [{ section: "later", text: "If you feel unsafe with your own thoughts, please tell someone now or call the Kenya Red Cross on 1199." }],
  funding_restrictions: [{ section: "later", text: "Talk to the Hub about emergency and flexible funding, and keep your organisation's records safe and complete." }],
  loss_of_employment: [{ section: "later", text: "Keep your contract and any letters. A paralegal can tell you whether the dismissal was lawful." }],
  forced_relocation: [{ section: "now", text: "If you must move, tell only the people who need to know where, and change your routine at the new place." }],
  closure_of_cso: [{ section: "later", text: "Back up your organisation's records and registration papers in a safe place, and speak to a lawyer about your options." }],
};

/** Risks that should alert the response team at once. */
const CRITICAL_RISKS = new Set(["direct_violence_assassination", "rape", "arbitrary_detention", "sexual_violence", "forced_relocation"]);

export interface BuiltPlan {
  headline: string;
  critical: boolean;
  sections: PlanSection[];
  contacts: SafetyContact[];
}

/** The plan for one report: everything its incident types and risks call for, once, in a sensible order. */
export function buildSafetyPlan(incidentTypes: string[], risks: string[] = []): BuiltPlan {
  const known = incidentTypes.filter((t) => t in PROFILES);
  const profiles = known.map((t) => PROFILES[t]);

  const collect = (key: "now" | "people" | "later" | "digital", prefix: string, base: string[] = []) => {
    const seen = new Set<string>();
    const out: PlanStep[] = [];
    const mk = step(prefix);
    const push = (text: string) => { if (!seen.has(text)) { seen.add(text); out.push(mk(text)); } };
    profiles.forEach((p) => (p[key] ?? []).forEach(push));
    risks.forEach((r) => (RISK_STEPS[r] ?? []).filter((x) => x.section === key).forEach((x) => push(x.text)));
    base.forEach(push);
    return out;
  };

  const sections: PlanSection[] = [
    { title: "Right now", steps: collect("now", "now", GENERAL.now) },
    { title: "Your phone and accounts", steps: collect("digital", "digital") },
    { title: "People and places", steps: collect("people", "people", GENERAL.people) },
    { title: "When you are ready", steps: collect("later", "later", GENERAL.later) },
  ].filter((s) => s.steps.length > 0);

  const contactKeys = new Set<string>(["emergency", "hub"]);
  profiles.forEach((p) => (p.contacts ?? []).forEach((c) => contactKeys.add(c)));
  const order = ["emergency", "gbv", "child", "redcross", "ipoa", "knchr", "eacc", "iebc", "hub"];

  return {
    headline: profiles[0]?.headline ?? "Your safety comes first. These steps are here whenever you want them.",
    critical: profiles.some((p) => p.critical) || risks.some((r) => CRITICAL_RISKS.has(r)),
    sections,
    contacts: order.filter((k) => contactKeys.has(k)).map((k) => CONTACTS[k]),
  };
}

/** Is a report serious enough to alert the response team immediately, whatever urgency the reporter chose? */
export function isCriticalReport(incidentTypes: string[], risks: string[] = [], urgency?: string | null): boolean {
  return urgency === "immediate" || buildSafetyPlan(incidentTypes, risks).critical;
}
