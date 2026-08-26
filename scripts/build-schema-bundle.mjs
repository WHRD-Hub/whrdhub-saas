#!/usr/bin/env node
/**
 * Concatenate the ordered migration set into one file that can be pasted into
 * a fresh Supabase project's SQL editor.
 *
 * The numbered migrations stay the source of truth; this bundle is generated
 * from them so the two can never drift. Regenerate with `npm run db:bundle`
 * after adding or changing a migration.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase");

// Order matters. The reporting platform owns `profiles`, so its schema must
// exist before the Hub schema extends it.
export const ORDER = [
  "reporting/001_combined_schema.sql",
  "reporting/002_fix_profiles_rls_recursion.sql",
  "reporting/003_onboarding.sql",
  "reporting/004_language_notifications.sql",
  "reporting/005_online_listening.sql",
  "001_hub_saas_schema.sql",
  "004_fix_rls_recursion.sql",
  "006_dashboard_features.sql",
  "007_storage.sql",
  "009_admin_hardening.sql",
  "010_blog_gallery.sql",
  "011_resources.sql",
  "012_publications_bucket.sql",
  "013_merge_reporting_platform.sql",
  "014_community_lifecycle.sql",
];

// Content seeds are optional: useful for a demo or staging project, noise in a
// production one. They go into a second bundle.
export const SEEDS = [
  "002_seed_blogs.sql",
  "003_seed_posts.sql",
  "005_seed_organizations.sql",
  "015_seed_demo_content.sql",
];

function bundle(files, title, note) {
  const stamp = "-".repeat(74);
  const parts = [
    `-- ${stamp}`,
    `--  ${title}`,
    `--  GENERATED FILE - do not edit. Run \`npm run db:bundle\` to rebuild.`,
    `--  Source files, in order:`,
    ...files.map((f) => `--    ${f}`),
    `--`,
    ...note.split("\n").map((l) => `--  ${l}`),
    `-- ${stamp}`,
    "",
  ];
  for (const f of files) {
    parts.push(`\n-- ${stamp}`, `-- BEGIN ${f}`, `-- ${stamp}\n`);
    parts.push(readFileSync(join(dir, f), "utf8").trimEnd(), "");
    parts.push(`-- END ${f}\n`);
  }
  return parts.join("\n");
}

writeFileSync(
  join(dir, "schema", "bootstrap.sql"),
  bundle(
    ORDER,
    "WHRD Hub - complete schema bootstrap",
    "Paste this whole file into the SQL editor of a new Supabase project.\n" +
      "It creates every table, type, function, trigger, RLS policy and storage\n" +
      "bucket the app needs. Idempotent: re-running it is safe and is also how\n" +
      "you bring an existing project up to date.",
  ),
);

writeFileSync(
  join(dir, "schema", "seed.sql"),
  bundle(
    SEEDS,
    "WHRD Hub - demo content seed",
    "Optional. Run AFTER bootstrap.sql to fill a new or staging project with\n" +
      "example organisations, stories, posts, comments and reports so every\n" +
      "screen has something in it. Safe to re-run; it will not duplicate rows.",
  ),
);

console.log("wrote supabase/schema/bootstrap.sql and supabase/schema/seed.sql");
