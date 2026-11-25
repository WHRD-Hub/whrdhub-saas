/**
 * How hard to compress a PDF, gentlest first. Shared by the browser upload
 * (lib/pdf/compress-client.ts) and the server-side restore script
 * (scripts/file-links.mjs), so a document compressed either way comes out the same.
 */
export interface Pass {
  label: string;
  maxEdge: number;
  quality: number;
}

/**
 * 1800px is roughly 150 dpi across an A4 page — the point where a photograph
 * still looks right on a laptop screen and prints acceptably. 900px is screen
 * only, and is a last resort before giving up.
 */
export const PASSES: Pass[] = [
  { label: "high quality", maxEdge: 2000, quality: 0.82 },
  { label: "good quality", maxEdge: 1600, quality: 0.75 },
  { label: "screen quality", maxEdge: 1200, quality: 0.7 },
  { label: "compact", maxEdge: 900, quality: 0.62 },
];
