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
