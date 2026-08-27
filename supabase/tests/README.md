# Database tests

These prove the schema actually behaves the way it is meant to, rather than
merely applying without error. They sign in as six different users and assert
what each one can see and do.

## Running them

You need a local PostgreSQL 16 and nothing else — no Supabase, no network.

```bash
npm run db:test
```

`install.sql` is applied both statement-by-statement and as a single
transaction. The Supabase SQL editor does the latter, and the difference is not
cosmetic: `ALTER TYPE ... ADD VALUE` succeeds under the first and makes the
whole script fail under the second, because PostgreSQL refuses to let a
transaction use an enum value it just added.

That script creates a throwaway database, applies `00_supabase_shim.sql` (a
minimal local stand-in for the parts of Supabase the schema depends on:
`auth.users`, `auth.uid()`, `storage.*` and the anon/authenticated/service_role
roles), then applies `schema/bootstrap.sql` and `schema/seed.sql` and runs every
assertion file in order. Any failure aborts with the expected and actual value.

`00_supabase_shim.sql` is **test scaffolding only**. It is never applied to a
real project, where Supabase provides all of it.

## What is covered

| File | Covers |
| --- | --- |
| `10_fixtures.sql` | Creates a member, an org admin, a Hub admin, a reporting defender, an anonymous reporter and an unrelated user, plus their content |
| `20_rls_assertions.sql` | Report visibility per role · content visibility · soft delete and who may purge · comments · membership approval · account deletion |
| `30_matching.sql` | Verifying a report assigns support services and notifies the reporter, and does not duplicate on re-save |
| `31_matching_county.sql` | Referrals prefer the reporter's county, fall back to national, and never answer a request with nothing |
| `40_moderation.sql` | A network suspends, only the Hub bans, neither reaches past its own level, and lifting one does not lift the other |
| `50_match_states.sql` | A referral starts as proposed · a stranger can neither see nor answer it · the survivor's accept is decisive and timestamped · a decline keeps its reason · a deleted report leaves the Hub's matching numbers |

## Adding a test

Assertions use two helpers defined at the top of each file: `pg_temp.as_user`
runs a query as a given user with RLS on, and `pg_temp.check` compares the
result against what you expect. Keep the label a plain sentence — it is what
prints when the suite fails.
