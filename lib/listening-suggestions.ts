/**
 * Accounts worth listening to, offered as one-click suggestions on the listening
 * page. Nothing here is watched until an administrator adds it, and each can be
 * paused or removed again afterwards.
 *
 * `check` is set where the handle was found by search rather than read from the
 * organisation's own website: look at the account before relying on it. Official
 * accounts are impersonated often, so a missing handle is better than a wrong one.
 */
export interface SuggestedSource {
  platform: "instagram" | "x" | "facebook";
  kind: "profile";
  handle: string;
  name: string;
  focus: string;
  check?: string;
}

const MV = { name: "Missing Voices Kenya", focus: "Enforced disappearances, abductions and extrajudicial killings" };
const WK = { name: "Wangu Kanja Foundation", focus: "Sexual violence and GBV: prevention, protection and response" };
const KN = { name: "Kenya National Commission on Human Rights", focus: "Official statements on abductions and disappearances" };
const DC = { name: "DCI Kenya", focus: "Police investigations: abduction, kidnapping, trafficking and rescues" };
const GA = { name: "State Department for Gender", focus: "GBV policy and reporting-platform updates" };

export const SUGGESTED_SOURCES: SuggestedSource[] = [
  // Read from the organisation's own website.
  { ...MV, platform: "x", kind: "profile", handle: "MissingVoicesKE" },
  { ...MV, platform: "instagram", kind: "profile", handle: "missingvoiceske" },
  { ...MV, platform: "facebook", kind: "profile", handle: "MissingVoicesKe" },
  { ...WK, platform: "x", kind: "profile", handle: "WanguKanjaF" },
  { ...WK, platform: "instagram", kind: "profile", handle: "wangukanjafoundation" },
  { ...WK, platform: "facebook", kind: "profile", handle: "wangukanjafoundation" },

  // The X handles were supplied by the team; the Meta accounts below came from search results only.
  { ...KN, platform: "x", kind: "profile", handle: "HakiKNCHR", check: "Handle supplied by the team, not yet checked against the organisation's site." },
  { ...KN, platform: "instagram", kind: "profile", handle: "hakiknchr", check: "Found by search; matches the X handle. Check it is the official account." },
  { ...KN, platform: "facebook", kind: "profile", handle: "knchr.org", check: "Found by search. Check it is the official page." },
  { ...DC, platform: "x", kind: "profile", handle: "DCI_Kenya", check: "Handle supplied by the team, not yet checked against the organisation's site." },
  { ...DC, platform: "facebook", kind: "profile", handle: "UpeleleziKenya", check: "Found by search; DCI names this page as its official one. No official Instagram was found, and impersonators exist." },
  { ...GA, platform: "x", kind: "profile", handle: "gender_ke", check: "Handle supplied by the team, not yet checked against the organisation's site." },
  { ...GA, platform: "facebook", kind: "profile", handle: "SDGAAKenya", check: "Found by search. Check it is the official page. No Instagram was found." },
];
