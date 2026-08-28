import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored by scripts/copy-pdf-worker.mjs on every build. It is a
    // third-party minified bundle, not source, and linting it produces
    // seventeen hundred findings about somebody else's code.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
