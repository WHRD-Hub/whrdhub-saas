/**
 * One source of truth for the option lists the reporting form, the reporter's
 * dashboard and the admin console all show. Values are what is stored; labels
 * are what people read.
 */

export const INCIDENT_TYPES = [
  { value: "gbv", label: "GBV" },
  { value: "police_brutality", label: "Police Brutality" },
  { value: "corruption", label: "Corruption" },
  { value: "goonism", label: "Goonism" },
  { value: "land_related", label: "Land-related" },
  { value: "environment_related", label: "Environment-related" },
  { value: "digital_threats", label: "Digital Threats" },
  { value: "enforced_disappearance", label: "Enforced Disappearance" },
  { value: "human_trafficking", label: "Human Trafficking" },
  { value: "labor_related", label: "Labor-related" },
  { value: "health_related", label: "Health-related" },
  { value: "academic_related", label: "Academic-related" },
  { value: "femicide", label: "Femicide" },
  { value: "pedicide", label: "Pedicide" },
  { value: "election_related", label: "Election-related" },
] as const;

/** Incident types that involve something happening online, so the evidence card applies. */
export const ONLINE_INCIDENT_TYPES: string[] = ["digital_threats"];

/** Reports filed before the new list used these; they still need a readable name. */
const LEGACY_INCIDENT_LABELS: Record<string, string> = {
  online_harassment: "Online harassment",
  physical_violence: "Physical violence",
  sexual_violence: "Sexual violence",
  workplace_abuse: "Workplace abuse",
  other: "Other",
};

export function incidentLabel(value: string): string {
  return (
    INCIDENT_TYPES.find((t) => t.value === value)?.label ??
    LEGACY_INCIDENT_LABELS[value] ??
    value.replace(/_/g, " ")
  );
}

/** Risks a defender is exposed to as a result of what was reported. Grouped for the form. */
export const RISK_GROUPS: { title: string; risks: { value: string; label: string }[] }[] = [
  {
    title: "Violence and threats",
    risks: [
      { value: "direct_violence_assassination", label: "Direct Violence and Assassinations" },
      { value: "intimidation_threats", label: "Intimidation and Threats" },
      { value: "sexual_violence", label: "Sexual Violence" },
      { value: "rape", label: "Rape" },
    ],
  },
  {
    title: "Online and digital",
    risks: [
      { value: "cyberbullying", label: "Cyberbullying" },
      { value: "gendered_disinformation", label: "Gendered Disinformation" },
      { value: "spyware", label: "Spyware" },
      { value: "digital_tracking", label: "Digital Tracking" },
      { value: "communications_interception", label: "Communications Interception" },
      { value: "digital_attacks", label: "Digital Attacks" },
      { value: "doxxing", label: "Doxxing" },
    ],
  },
  {
    title: "Legal and state",
    risks: [
      { value: "arbitrary_detention", label: "Arbitrary Detention and Imprisonment" },
      { value: "criminalization_activism", label: "Criminalization of Activism" },
      { value: "spurious_lawsuits", label: "Spurious Lawsuits" },
    ],
  },
  {
    title: "Social and community",
    risks: [
      { value: "public_defamation", label: "Public Defamation" },
      { value: "social_ostracization", label: "Social Ostracization" },
      { value: "community_hostility", label: "Community Hostility" },
      { value: "betrayal_local_networks", label: "Betrayal from Local Networks" },
    ],
  },
  {
    title: "Wellbeing and livelihood",
    risks: [
      { value: "psychological_stress", label: "Psychological Stress" },
      { value: "secondary_trauma", label: "Secondary Trauma" },
      { value: "mental_health_struggles", label: "Mental Health Struggles" },
      { value: "funding_restrictions", label: "Funding Restrictions" },
      { value: "loss_of_employment", label: "Loss of Employment" },
      { value: "forced_relocation", label: "Forced Relocation" },
      { value: "closure_of_cso", label: "Closures of Civil Society Organizations" },
    ],
  },
];

export const RISKS = RISK_GROUPS.flatMap((g) => g.risks);

export function riskLabel(value: string): string {
  return RISKS.find((r) => r.value === value)?.label ?? value.replace(/_/g, " ");
}

/** Support a reporter can ask for. "Referral" was removed: it is what the Hub does, not something to ask for. */
export const SUPPORT_TYPES = [
  { value: "legal", label: "Legal support" },
  { value: "medical", label: "Medical care" },
  { value: "psychosocial", label: "Counselling" },
  { value: "digital_security", label: "Digital security" },
  { value: "shelter", label: "Safe shelter" },
  { value: "financial", label: "Financial support" },
  { value: "other", label: "Other" },
] as const;

export function supportLabel(value: string): string {
  return SUPPORT_TYPES.find((s) => s.value === value)?.label ?? value.replace(/_/g, " ");
}

/** Service categories an admin can file a service under. */
export const SERVICE_CATEGORIES = ["legal", "medical", "psychosocial", "digital_security", "shelter", "financial", "other"] as const;

export const KENYA = "Kenya";

/** Countries a report can come from, apart from Kenya (whose counties are listed on their own). */
export const OTHER_COUNTRIES = ["Uganda", "Tanzania", "DRC", "Guinea"] as const;

/** Countries services can be offered in. */
export const SERVICE_COUNTRIES = [KENYA, ...OTHER_COUNTRIES] as const;

export const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo Marakwet", "Embu", "Garissa", "Homa Bay",
  "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu",
  "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru",
  "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita Taveta", "Tana River", "Tharaka Nithi", "Trans Nzoia",
  "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

/** The country a stored location belongs to: a Kenyan county means Kenya, otherwise the value is the country. */
export function countryOf(location: string | null | undefined): string | null {
  if (!location) return null;
  if ((OTHER_COUNTRIES as readonly string[]).includes(location)) return location;
  return KENYA_COUNTIES.includes(location) ? KENYA : null;
}
