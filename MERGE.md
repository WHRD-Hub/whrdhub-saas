# Merging the reporting platform into the SaaS platform

The WHRD Hub reporting platform (the `whrdhub` repo) now lives inside this app.
Both already shared one Supabase project; this merge makes them share one
codebase, one session, one navigation and one design system.

Branch: `feat/merge-reporting-platform`.

---

## What moved where

| Was (reporting platform) | Is now |
| --- | --- |
| `/report`, `/report/success` | same paths, public, no account needed |
| `/dashboard` (reporter home) | `/dashboard/reports` |
| `/dashboard/reports/[id]` | same path, inside the member shell |
| `/admin` | `/hub/reporting` |
| `/admin/reports`, `/admin/reports/[id]` | `/hub/reporting/reports[...]` |
| `/admin/services` | `/hub/reporting/services` |
| `/admin/analytics` | `/hub/reporting/analytics` |
| `/admin/linkages` | `/hub/reporting/linkages` |
| `/admin/listening` | `/hub/reporting/listening` |
| `/map` | `/hub/reporting/map` |
| `/api/ussd`, `/api/ussd/events` | unchanged |
| `/api/meta/webhook`, `/api/chat`, `/chat` | unchanged |
| `/auth/confirm` | unchanged; `/auth/login` → `/login` |
| `components/admin/*` | `components/reporting/admin/*` |
| `app/actions/submit-report.ts` | `app/actions/report-submit.ts` |
| `app/actions/admin-actions.ts` | `app/actions/reporting-admin.ts` |

Update the Africa's Talking USSD callback URL and the Meta webhook callback URL
to this app's domain. The paths themselves have not changed.

## Navigation

* **Landing / public nav** — the old "Reporting ⇄" switch is a magenta
  **Report Abuse** button pointing at `/report`, matching how the reporting
  platform's own entry point behaves.
* **Member sidebar** — *My Reports* is a real in-app page. *Report Abuse* in
  the sidebar footer is an internal link.
* **Hub sidebar** — items are grouped under **Community** and **Reporting**
  headings. The reporting console is a section of the main nav, not a link out.

## Roles and access

Two role systems existed: `profiles.user_type` (`reporter` | `defender` |
`admin`) from the reporting platform, and `profiles.is_hub_admin` from the Hub.
`lib/reporting-access.ts` is now the single decision point:

* **administer** — `is_hub_admin` OR `user_type = 'admin'`. Verify reports,
  assign services, manage the service directory, run online listening.
* **triage** — the above plus `user_type = 'defender'`. Open cases, change
  status, see the map.

`/hub` is split into two route groups (URLs unchanged):

* `app/hub/(community)/` — requires `is_hub_admin`; a triage-only defender is
  redirected to the reporting console.
* `app/hub/reporting/` — requires triage. The per-page `user_type !== 'admin'`
  checks the old code carried have been removed in favour of this layout.

Migration `013` mirrors all of this in RLS. **Before it, a Hub admin whose
`user_type` was still `reporter` could open the reporting console and see an
empty list** — the UI let them in, the database returned nothing.

## Anonymous reporters

The report form creates credentialed-but-anonymous accounts
(`is_anonymous = true`, `user_type = 'reporter'`, `hub_onboarded = false`).
The Hub's member layout forces anyone without `hub_onboarded` into community
onboarding, which would have dropped a survivor who had just filed a report
into a "choose your county network and CBO" wizard.

`getCurrentUser()` now returns `isReporterOnly`. Those accounts skip Hub
onboarding, land on `/dashboard/reports`, and get a reports-only sidebar. They
can still become full members later by completing onboarding.

## Database

Run **`supabase/013_merge_reporting_platform.sql`** once. It is idempotent and
drops nothing. It:

1. Ensures both profile shapes exist on the one `profiles` table.
2. Adds `can_administer_reports()` / `can_triage_reports()` and rewrites the
   reporting RLS policies against them.
3. Reconciles `notifications`. **Both apps ran `create table if not exists
   public.notifications` with different columns** — the Hub's (`read`, `title`,
   `body`, `link`) and the reporting platform's (`is_read`, `report_id`,
   `service_name`). Whichever migration ran first won. `013` makes the table
   satisfy both, keeps `read` and `is_read` in step with a trigger, relaxes the
   `title NOT NULL` constraint that would have rejected the reporting triggers'
   inserts, and gives report notifications a title and link so they appear in
   the Hub notifications view.
4. Extends `hub_overview()` with reporting counters.
5. Promotes existing reporting admins to `is_hub_admin` and marks staff as
   onboarded.

The reporting platform's own historical migrations are kept in
`supabase/reporting/` so a fresh project can be built from this repo alone.
See the README in that folder for the ordering.

## Environment

Add to `.env.local` (all optional — each feature degrades quietly if unset):

```
AT_USERNAME=            # Africa's Talking, for USSD confirmation SMS
AT_API_KEY=
OPENROUTER_API_KEY=     # resource assistant chat
OPENROUTER_MODEL=       # defaults to openai/gpt-4o-mini
META_APP_SECRET=        # online listening
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_VERIFY_TOKEN=
```

`NEXT_PUBLIC_REPORTING_URL` is no longer used for navigation and can be removed
once the old deployment is retired.

## Deliberate deviations from a straight copy

* **No new npm packages.** `sonner` was replaced by
  `components/ui/toast.tsx`, and Radix's Dialog / Select / Sheet by plain
  components. Leaflet is loaded from the CDN at runtime by `lib/leaflet.ts`
  (its stylesheet already was). **If you would rather bundle it, run
  `npm i leaflet @types/leaflet` and change `loadLeaflet()` back to
  `import("leaflet")` — the returned shape is identical.**
* **Styling.** Ported markup was mechanically rewritten from shadcn's semantic
  tokens onto the Hub's brand tokens (`primary` → `purple`, `border` → `line`,
  `muted-foreground` → `muted`, and so on), and the page chrome was rebuilt
  around `DashboardShell`. `components/ui/badge.tsx` maps shadcn's Badge
  variants onto the Hub palette; `components/ui/button.tsx` gained `asChild`
  and shadcn's variant/size names so ported files needed no edits.
* **`next-themes`** was dropped — the Hub is light-only.

## Fixes made along the way

* **Quick exit now works.** The report page has always said "press Esc twice to
  leave immediately"; nothing listened for it. `components/reporting/quick-exit.tsx`
  implements it, and uses `location.replace` so the Back button does not return
  to the form.
* **The proxy would have blocked anonymous reporting.** `/report`, `/offline`,
  the machine-called API routes and the PWA files are now explicitly public in
  `lib/supabase/proxy.ts`.
* **`removeService` had no permission check.** It does now.
* **The chat transcript could be wiped.** Its persist effect fired with an empty
  list before the load effect had run, briefly writing `[]` over saved history.
  Both effects are gone; the transcript is read with `useSyncExternalStore`.
* **Language selection no longer flashes English.** `lib/i18n/language-store.ts`
  exposes the preference as an external store instead of a mount effect.

## Known follow-ups

* `npm i leaflet @types/leaflet` and un-CDN the map (see above).
* The reporting platform's own `/onboarding` (role choice + terms) was not
  ported; the Hub's onboarding is the single flow. If you still need the
  reporting terms acceptance, `lib/i18n/terms.ts` was carried over and holds
  the copy in English and Kiswahili.
* `profiles.onboarding_completed` (reporting) and `profiles.hub_onboarded`
  (Hub) both survive. Only `hub_onboarded` drives redirects now; the older
  column is left in place rather than dropped.
* ESLint reports 20 pre-existing errors from React Compiler rules in
  `rich-editor`, `rich-text`, `accessibility-controls`, `dashboard-shell`,
  `use-reaction` and `post-composer-modal`. The merge adds none — that count is
  identical on `main`.

---

# Part two: community lifecycle

The merge above put the two products in one app. This part makes the joins
between them actually work: an account that starts on the reporting side can
become a full member, content can be taken down without being destroyed, and
the Hub keeps a record of everything.

## The journeys, end to end

**Report anonymously.** `/report` is public — the middleware allows it
explicitly. Submitting creates a credentialed but anonymous auth user (a
generated username, a placeholder `@whrdhub.local` address that can never
receive mail) and signs the reporter straight in. They land on
`/dashboard/reports` with a reports-only sidebar, never the member onboarding
wizard.

**Report with an account.** Same form, no account creation; the report attaches
to the signed-in user.

**Claim an anonymous account.** `/dashboard/account` → *Secure this account*.
Adds a real address and optionally a password to the **same** auth user, so
every report already filed comes with it. Nothing is migrated because nothing
moves. Sets `profiles.claimed_at` and clears `is_anonymous`.

**Join a network.** From `/organizations` (*Ask to join*, with a note to the
admins) or through onboarding. Either way it creates a **pending** request, not
a membership. Founding a new organisation still makes you its admin at once.

**Network admins verify members.** `/dashboard/network`. Org admins see the
requests for the organisations they administer; Hub admins see all of them.
Requests coming from the reporting side are flagged, because those are the
people an organisation is least likely to recognise on sight. Admins can also
promote and demote.

**Write to the feed and publish stories.** Any signed-in account can submit.
Non-admin posts and stories go out as `pending` and reach the feed once a Hub
admin approves them at `/hub/posts` and `/hub/blogs`. The author sees their own
pending item in the feed with an "Awaiting review" banner.

**Referral matching.** Verifying a report auto-assigns support services. The
rule is county-aware: for each kind of support asked for, the reporter gets the
services in their own county *and* the ones operating nationally, but not other
counties' — unless that category has neither, in which case the nearest
available service is assigned rather than answering with nothing. Each referral
carries a note saying which of the three it was.

## Deleting things

Two operations, deliberately named differently in the UI.

**Delete** — anyone, on their own post, story or comment. A soft delete. The
item leaves the feed at once, stays in the author's own view marked *Deleted*
with a Restore control, and stays fully readable by Hub admins at
`/hub/deleted`.

**Delete permanently** — Hub admins only, from the deleted views, behind a
typed `DELETE` confirmation. This is the only thing in the system that destroys
a row.

Reports work the same way but only an administrator can delete one, always with
a reason: the reporter loses sight of the case, so the record of why has to
survive. Deleted cases live at `/hub/reporting/deleted`.

**Accounts.** `/dashboard/account` → *Delete your account*. The profile is
marked deleted, every post, story and comment is soft-deleted, memberships are
closed, and the session ends. The auth user and all the content are kept, and
`/hub/accounts` shows deleted accounts with a count of what was in each. The
dialog says plainly that reports are **not** deleted: an open case belongs to
the response team, and letting an account closure erase a safeguarding record
would be the wrong default.

A deleted account keeps a technically valid session until it is signed out, so
every authenticated layout checks the flag and redirects to `/account-deleted`,
which signs the session out on arrival.

## Why deleted content stays visible to its author

Not a UI choice — a database constraint that turned out to be the right
behaviour. PostgreSQL applies SELECT policies to the *new* row of an UPDATE. A
policy that hid deleted rows from their author would make the author's own
delete impossible: the write that sets `deleted_at` would move the row out of
their visibility and be rejected. Keeping the author's read access is both
necessary and what "content sits as deleted on their view" asks for.

## Database

Two more migrations, both idempotent:

* **`014_community_lifecycle.sql`** — soft-delete columns on posts, blogs,
  reports and resources; the `post_comments` table; membership status with
  `is_org_admin()` / `my_admin_org_ids()`; `delete_account()` and
  `restore_account()`; rewritten RLS for all of the above; county-aware
  referral matching; storage policy for report evidence routed through the
  shared role function; explicit grants so the schema also stands up on a plain
  Postgres.
* **`015_seed_demo_content.sql`** — support services covering every category
  (without these, verifying a report assigns nothing), example reports,
  comments, publications and listening signals. Creates no auth users on
  purpose: seeded content carries a display name on the row instead, so the
  seed cannot manufacture accounts anyone could sign into.

### Standing up a new project

```bash
# 1. paste supabase/schema/bootstrap.sql into the SQL editor   (schema)
# 2. paste supabase/schema/seed.sql                            (demo content, optional)
```

Both are generated from the numbered migrations by `npm run db:bundle`, so they
cannot drift from the real migration history. Both are idempotent — re-running
`bootstrap.sql` is also how you bring an **existing** project up to date.

Order matters and the bundle encodes it: the reporting schema owns `profiles`,
so it must exist before the Hub schema extends it. Hub-first is not a supported
order and will fail on `relation "public.profiles" does not exist`.

### Testing the database

```bash
npm run db:test     # needs a local PostgreSQL 16, nothing else
```

Creates a throwaway database, applies `bootstrap.sql` **twice** and `seed.sql`
**twice** (proving idempotency), then runs 56 assertions that sign in as six
different users and check what each can actually see and do — report visibility
per role, soft delete and who may purge, comments, membership approval, account
deletion, and referral matching. `supabase/tests/README.md` explains how to add
one.

## Bugs found and fixed in this pass

* **A fresh project could not be created at all.** On an empty database
  `006_dashboard_features.sql` aborted with `column "read" does not exist` —
  the two `notifications` definitions colliding. Made order-independent.
* **`013` could not be re-run.** It dropped the old policy names before
  recreating but not its own, so a second run failed on "policy already
  exists".
* **A seed used `ON CONFLICT` against a partial unique index**, which Postgres
  rejects unless the predicate is restated.
* **Hub admins could not view report evidence.** The `report-screenshots`
  storage policy still tested `profiles.user_type` directly.
* **Onboarding added you to any CBO you picked**, with no approval step.
* **`removeService` had no permission check.**
* **The chat transcript could be wiped** by its persist effect firing before
  its load effect.
* **Matching ignored county**, so a Kitui reporter could be referred to a
  Nakuru shelter while the Kitui desk sat unused.

## Known follow-ups

* `npm i leaflet @types/leaflet` and un-CDN the map.
* Comment replies are modelled (`post_comments.parent_id`) but the UI renders a
  single flat level. Threading is a UI change only.
* `profiles.onboarding_completed` (reporting) and `profiles.hub_onboarded`
  (Hub) both survive; only the latter drives redirects.
