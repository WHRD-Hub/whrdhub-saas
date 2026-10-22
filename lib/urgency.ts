/**
 * Urgency colours, defined once. Every admin surface (tables, badges, charts,
 * the map) reads from here so red always means "in danger now", amber "this
 * week" and green "no rush".
 */
export type Urgency = "immediate" | "within_week" | "no_rush";

export const URGENCY_ORDER: Urgency[] = ["immediate", "within_week", "no_rush"];

export const URGENCY_META: Record<Urgency, { label: string; hex: string; tone: "red" | "amber" | "green"; badge: "destructive" | "warning" | "success" }> = {
  immediate: { label: "Immediate", hex: "#dc2626", tone: "red", badge: "destructive" },
  within_week: { label: "Within week", hex: "#d97706", tone: "amber", badge: "warning" },
  no_rush: { label: "No rush", hex: "#16a34a", tone: "green", badge: "success" },
};

export function urgencyMeta(u: string | null | undefined) {
  return URGENCY_META[(u as Urgency) in URGENCY_META ? (u as Urgency) : "within_week"];
}

/** Chart/legend colour by display label ("Immediate", "Within Week", "No Rush"). */
export function urgencyHexByLabel(label: string): string {
  const l = label.toLowerCase().replace(/\s+/g, "_");
  return urgencyMeta(l).hex;
}
