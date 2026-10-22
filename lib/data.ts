/**
 * Static content and reference data.
 * Copy is drawn from whrdhub.org and kept in the Hub's own voice: warm,
 * plain-spoken, no jargon. (Note the Hub uses "femtorship", not "mentorship".)
 */

export const SITE = {
  name: "WHRD Hub",
  tagline: "A home for women human rights defenders across Kenya & Beyond",
  vision:
    "An empowered, just, and equitable society where women human rights defenders thrive to their full potential.",
  mission:
    "We amplify and enhance holistic protection programs that invest in femtorship and economic empowerment of networks of women human rights defenders.",
};

export const LAWLOR_QUOTE = {
  text: "Many women human rights defenders are active at the start of a crisis, before it becomes a conflict, helping people to reach safety or to find what they need to stay alive. They are present throughout the darkest days, holding communities together.",
  who: "Mary Lawlor",
  role: "UN Special Rapporteur on Human Rights Defenders",
};

export const PILLARS: { title: string; body: string }[] = [
  {
    title: "Safety and Security",
    body: "Actions that keep women defenders safe, through a gender-sensitive approach.",
  },
  {
    title: "Wellbeing",
    body: "Making sure women defenders stay grounded, emotionally and physically.",
  },
  {
    title: "Livelihoods",
    body: "Backing investments in startups by women defenders so they can sustain themselves and their work.",
  },
  {
    title: "Femtorship",
    body: "Growing the next generation of women defenders and activists, defender to defender.",
  },
  {
    title: "Movement and Partnership",
    body: "Building strong networks nationally, regionally, and across the continent to respond to the anti-rights movement.",
  },
  {
    title: "Institution Building",
    body: "Strong governance, clear systems, and sustainable funding that position the Hub for the long term.",
  },
];

/** Femtorship questionnaire, in the order defenders answer it. */
export const FEMTORSHIP_QUESTIONS = {
  in_leadership_role: "Are you currently in any leadership role?",
  leadership_detail: "If yes, tell us a little about that role.",
  has_guide: "Do you have someone who guides you in your work?",
  relationship_nature: "How would you describe that relationship?",
  barriers:
    "What are the main barriers to having a femtor, and would you be interested in having one?",
  desired_qualities: "What qualities would you look for in a femtor?",
  guidance_areas:
    "Are there specific areas where you need guidance to strengthen your human rights work or advocacy?",
  guidance_areas_hint: "Pick a maximum of 3",
  can_provide: "Are you in a capacity to provide femtorship to others?",
  support_offered: "What kinds of support can you provide?",
  support_detail: "Anything else you would like a match to know? (any special needs)",
};

/**
 * Shared vocabulary for both "areas I need guidance in" (mentee needs) and
 * "support I can provide" (mentor capacity). Matching looks for overlap here.
 */
export const FOCUS_AREAS = [
  "Legal advocacy",
  "Digital security",
  "Physical safety",
  "Wellbeing and self-care",
  "Fundraising and grants",
  "Organisational leadership",
  "Community mobilising",
  "Media and storytelling",
  "Policy and lobbying",
  "Research and documentation",
  "Financial management",
  "Public speaking",
];

export const FEMTOR_QUALITIES = [
  "Experienced in my field",
  "Good listener",
  "Well connected",
  "Patient and encouraging",
  "Strategic thinker",
  "Available and reliable",
  "Respect",
  "Time management",
];

/** The eight county networks the Hub currently operates in (matches the site). */
export const ACTIVE_COUNTIES = [
  "Nairobi",
  "Kitui",
  "Kisumu",
  "Bomet",
  "Marsabit",
  "Meru",
  "Mombasa",
  "Nakuru",
];

export const CONTENT_STATUS_META: Record<
  string,
  { label: string; tone: "amber" | "green" | "red" | "slate" }
> = {
  draft: { label: "Draft", tone: "slate" },
  pending: { label: "Awaiting review", tone: "amber" },
  approved: { label: "Published", tone: "green" },
  rejected: { label: "Not approved", tone: "red" },
};

export const VERIF_STATUS_META: Record<
  string,
  { label: string; tone: "amber" | "green" | "red" | "slate" }
> = {
  pending: { label: "Pending verification", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Not verified", tone: "red" },
  needs_more_info: { label: "Needs more info", tone: "slate" },
};
