/** Friendly generated usernames for anonymous accounts, e.g. "brave-river-x7k2". */
const ADJECTIVES = [
  "brave","strong","bold","fierce","proud","wise","calm","bright",
  "steady","gentle","swift","clear","free","safe","sure","true",
  "kind","warm","fair","pure","keen","vast","deep","cool",
];
const NOUNS = [
  "voice","heart","shield","light","hope","star","path","flame",
  "river","dawn","seed","rose","oak","bird","reef","tide",
  "peak","leaf","wave","song","wind","field","moon","sun",
];

export function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${adj}-${noun}-${suffix}`;
}
