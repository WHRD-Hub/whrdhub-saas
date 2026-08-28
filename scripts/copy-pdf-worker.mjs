/**
 * Put pdf.js's worker where the browser can fetch it.
 *
 * pdf.js renders in a worker and needs a URL for it. Referencing the file
 * through `new URL(..., import.meta.url)` is the documented route and it is not
 * reliable here: Turbopack emitted an earlier worker as a raw source asset
 * rather than a bundle, which fails silently at runtime and passes every build.
 * Copying the already-built .mjs into public/ removes the bundler from the
 * question entirely — the file is served as-is, from a path we control.
 *
 * Runs from `prebuild`, so Vercel does it on every deployment.
 */
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { createRequire } from "module";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
// The legacy worker, matching the legacy build imported by lib/pdf/first-page.ts.
// The two must be the same version or pdf.js refuses to start; copying from the
// installed package is what guarantees that.
const from = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "legacy", "build", "pdf.worker.min.mjs",
);
const to = join(process.cwd(), "public", "pdf.worker.min.mjs");

if (!existsSync(from)) {
  console.error(`pdf.js worker not found at ${from} — is pdfjs-dist installed?`);
  process.exit(1);
}
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`pdf.js worker → public/pdf.worker.min.mjs`);
