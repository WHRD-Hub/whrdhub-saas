/**
 * Watch keywords for the forms of political harassment defenders report:
 * threats and violence, digital abuse, legal and state pressure, social
 * hostility and the pressure on funding and work. They are added to the online
 * listening keyword list in one click, so the vocabulary the risks form uses is
 * what the listener looks for.
 */
export interface SeedKeyword { word: string; severity: "high" | "medium" | "low" }

export const POLITICAL_HARASSMENT_KEYWORDS: SeedKeyword[] = [
  // Violence and threats
  { word: "assassination", severity: "high" }, { word: "assassinate", severity: "high" },
  { word: "kill her", severity: "high" }, { word: "death threat", severity: "high" },
  { word: "intimidation", severity: "high" }, { word: "threatened", severity: "medium" },
  { word: "sexual violence", severity: "high" }, { word: "gang rape", severity: "high" },
  { word: "abducted", severity: "high" }, { word: "disappeared", severity: "high" },
  // Online and digital
  { word: "cyberbullying", severity: "medium" }, { word: "disinformation", severity: "medium" },
  { word: "spyware", severity: "high" }, { word: "pegasus", severity: "high" },
  { word: "tracked", severity: "medium" }, { word: "wiretap", severity: "high" },
  { word: "intercepted", severity: "medium" }, { word: "hacked", severity: "high" },
  { word: "leaked her address", severity: "high" }, { word: "revenge porn", severity: "high" },
  // Legal and state
  { word: "arbitrary arrest", severity: "high" }, { word: "unlawful detention", severity: "high" },
  { word: "detained", severity: "medium" }, { word: "jailed", severity: "medium" },
  { word: "criminalise", severity: "medium" }, { word: "criminalize", severity: "medium" },
  { word: "frivolous lawsuit", severity: "medium" }, { word: "slapp", severity: "medium" },
  // Social and community
  { word: "defamation", severity: "medium" }, { word: "smear campaign", severity: "high" },
  { word: "ostracised", severity: "medium" }, { word: "ostracized", severity: "medium" },
  { word: "shunned", severity: "low" }, { word: "betrayed", severity: "low" },
  // Wellbeing and livelihood
  { word: "burnout", severity: "low" }, { word: "trauma", severity: "medium" },
  { word: "lost her job", severity: "medium" }, { word: "fired for activism", severity: "medium" },
  { word: "funding cut", severity: "low" }, { word: "forced to relocate", severity: "medium" },
  { word: "organisation shut down", severity: "medium" }, { word: "ngo deregistered", severity: "medium" },
];
