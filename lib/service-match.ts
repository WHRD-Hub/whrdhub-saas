/**
 * Which support services fit a case, so the list a person chooses from starts
 * with the likeliest ones. This is the convention for every case:
 *
 *   - a case someone reported: the support they asked for decides first, the kind
 *     of incident second, and the best match is picked for them to confirm;
 *   - a case found by online listening: nobody asked for anything, so nothing is
 *     picked. The list is ordered by the kind of case alone and a person chooses.
 */

/** What each kind of incident usually needs, most important first. */
const NEEDS: Record<string, string[]> = {
  gbv: ["medical", "psychosocial", "legal", "shelter"],
  femicide: ["legal", "psychosocial", "shelter"],
  pedicide: ["legal", "psychosocial", "medical"],
  police_brutality: ["legal", "medical", "psychosocial"],
  goonism: ["legal", "medical", "psychosocial"],
  corruption: ["legal"],
  land_related: ["legal", "financial"],
  environment_related: ["legal"],
  digital_threats: ["digital_security", "psychosocial", "legal"],
  enforced_disappearance: ["legal", "psychosocial"],
  human_trafficking: ["shelter", "legal", "medical", "psychosocial"],
  labor_related: ["legal", "financial"],
  health_related: ["medical", "psychosocial"],
  academic_related: ["legal", "psychosocial"],
  election_related: ["legal", "digital_security"],
  // Reports filed before the current list.
  online_harassment: ["digital_security", "psychosocial", "legal"],
  physical_violence: ["medical", "legal", "psychosocial"],
  sexual_violence: ["medical", "psychosocial", "legal", "shelter"],
};

/** The reporter's own wording of the support they need, as service categories. */
const SUPPORT_TO_CATEGORIES: Record<string, string[]> = {
  legal: ["legal"], medical: ["medical"], psychosocial: ["psychosocial"], counselling: ["psychosocial"],
  shelter: ["shelter"], digital_security: ["digital_security"], financial: ["financial"], other: ["other"],
};

export interface RankableService { id: string; category: string; name: string }

/** How well each category fits the case; higher is better. */
function categoryScores(incidentTypes: string[], supportNeeded: string[]): Map<string, number> {
  const scores = new Map<string, number>();
  const add = (cat: string, n: number) => scores.set(cat, (scores.get(cat) ?? 0) + n);
  for (const t of incidentTypes) (NEEDS[t] ?? []).forEach((cat, i, all) => add(cat, all.length - i));
  // What the reporter asked for outweighs anything inferred from the incident.
  for (const s of supportNeeded) for (const cat of SUPPORT_TO_CATEGORIES[s] ?? [s]) add(cat, 100);
  return scores;
}

/** The services in the order they should be offered, with the ones that fit the case marked. */
export function rankServices<T extends RankableService>(
  services: T[],
  c: { incidentTypes: string[]; supportNeeded?: string[] },
): { ordered: T[]; fits: Set<string> } {
  const scores = categoryScores(c.incidentTypes, c.supportNeeded ?? []);
  const score = (s: T) => scores.get(s.category) ?? 0;
  const ordered = [...services].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  return { ordered, fits: new Set(ordered.filter((s) => score(s) > 0).map((s) => s.id)) };
}
