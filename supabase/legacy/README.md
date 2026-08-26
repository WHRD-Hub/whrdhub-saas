# Historical migrations

These are the incremental migrations the two apps accumulated before they were
merged, kept for provenance. **You do not need to run any of them.**

`supabase/install.sql` supersedes the lot. It is a single idempotent script
that builds the complete database from empty and also brings an existing
project up to date, and it is verified to produce a schema identical to what
running this whole sequence produces — same 263 columns, 58 indexes and 73
constraints.

If you are curious about why something is the way it is, the story runs:

* `reporting/001`–`005` — the reporting platform: profiles, reports, services,
  referrals, the USSD session store, notifications, online listening.
* `001`–`012` — the Hub: county networks, organisations, memberships,
  femtorship, posts, blogs, reactions, resources, storage buckets.
* `013` — reconciling the two after the merge: one role model, RLS that lets a
  Hub admin actually see reports, and the two colliding `notifications` shapes.
* `014` — community lifecycle: soft delete, comments, membership approval,
  account deletion, county-aware matching.
* `015` — demo content.

Two of these do not apply cleanly on a fresh database on their own, which is
part of why they were replaced: `006` collides with the reporting platform's
`notifications` table, and the Hub schema cannot run before the reporting
schema because it extends `profiles`.
