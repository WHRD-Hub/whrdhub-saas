const TAG = /(?:^|[^\w&])#([A-Za-z][A-Za-z0-9_]{2,29})(?![\w])/g;

/** The hashtags in a piece of text, lowercased and without repeats. Pure, so it is safe in the browser too. */
export function extractTags(text: string): string[] {
  return [...new Set([...text.matchAll(TAG)].map((m) => m[1].toLowerCase()))];
}
