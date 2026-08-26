# Reporting platform schema (historical)

These are the migrations that were applied by the standalone reporting
platform (the `whrdhub` repo) before it was merged into this app. They already
ran against the shared Supabase project, so you do not need to run them again
on an existing environment.

They are kept here so a **fresh** project can be built from this repo alone.
For a new environment run, in order:

1. `reporting/001_combined_schema.sql` … `reporting/005_online_listening.sql`
2. `001_hub_saas_schema.sql` … `012_publications_bucket.sql`
3. `013_merge_reporting_platform.sql`  ← reconciles the two, run last

Migration 013 is the one that matters for an existing environment: it unifies
the role model, fixes reporting RLS so Hub admins can see reports, and merges
the two `notifications` table shapes.
