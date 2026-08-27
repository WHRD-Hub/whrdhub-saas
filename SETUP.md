# WHRD Hub — setup

One app: the community platform (landing site, feed, county networks, stories,
femtorship) and the reporting platform (anonymous and account-based reporting,
the response console, USSD, online listening) sharing one codebase, one
Supabase project and one session.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up the database

Open the Supabase SQL editor and run **one file**:

```
supabase/install.sql
```

That is the whole thing: extensions, types, tables, indexes, functions,
triggers, row-level security, the four storage buckets and their policies, and
seed content so a fresh project has county networks, organisations, support
services, stories, posts and publications in it.

It is idempotent. Run it again any time — that is also how you apply an update.

If your project was created before the suspension feature existed, the script
stops immediately with the one line to run first. That is deliberate:
PostgreSQL will not let a transaction use an enum value that the same
transaction added, and the SQL editor is one transaction.

Then make yourself an administrator:

```sql
update public.profiles set is_hub_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

The files in `supabase/legacy/` are the historical incremental migrations. They
are kept for provenance and do not need to be run.

### Verifying the schema

```bash
npm run db:test
```

Needs a local PostgreSQL 16 and nothing else. It builds a throwaway database
and applies `install.sql` four times to prove it is idempotent — twice
statement-by-statement and twice wrapped in a single transaction, because that
is how the Supabase SQL editor runs a pasted script and the two are not
equivalent. Then it runs 101 assertions covering row-level security, deletion,
membership approval, moderation, referral matching and the referral state
machine. See `supabase/tests/README.md`.

## 3. Configure Supabase Auth

Under **Authentication -> URL Configuration**:

* **Site URL**: `https://<your-domain>`. A new project defaults this to
  `http://localhost:3000`, and getting it wrong is not obvious, because of the
  next point.
* **Redirect URLs**: add every origin the app is served from.

  ```
  https://<your-domain>/auth/callback
  http://localhost:3000/**                 # local development
  https://*-<your-team>.vercel.app/**      # preview deployments, if you use them
  ```

  If both the apex and `www` serve the site, list both. The app asks to come
  back to `window.location.origin`, so the origin the visitor is actually on is
  the one that must be allow-listed.

**Why this matters more than it looks.** Supabase does not error on a redirect
URL that is not on the list. It silently falls back to the Site URL. A missing
entry plus the default Site URL sends everyone who signs in on the live site to
`localhost:3000`, with nothing in the logs to explain it.

Under **Authentication -> Providers**, enable **Google**. Its authorised
redirect URI belongs in the Google Cloud Console, and it is Supabase's own
callback, not your domain:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

## 4. Environment

Copy `.env.example` to `.env.local` and fill in what you need. Only the three
Supabase values are required; every other integration degrades quietly when its
variables are absent.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=

AT_USERNAME=            # Africa's Talking, for USSD confirmation SMS
AT_API_KEY=
OPENROUTER_API_KEY=     # the in-app resource assistant
META_APP_SECRET=        # online listening
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_VERIFY_TOKEN=
```

## 5. External callbacks

Point these at the deployed domain. The paths have not changed from the
standalone reporting platform.

| Service | URL |
| --- | --- |
| Africa's Talking, USSD | `https://<domain>/api/ussd` |
| Africa's Talking, session events | `https://<domain>/api/ussd/events` |
| Meta webhook | `https://<domain>/api/meta/webhook` |

## 6. Run it

```bash
npm run dev
```

## Notes

**It is a progressive web app.** Visitors are offered installation to the home
screen. Once installed it works without a connection: reports and feed posts
written offline are held in an IndexedDB outbox and send themselves when the
connection returns. The service worker deliberately caches no authenticated
HTML and no report content.

**Roles.** `profiles.is_hub_admin` makes someone a Hub administrator;
`profiles.user_type` of `defender` gives reporting triage access without the
community console. An organisation can have any number of admins, appointed by
its existing admins or by any Hub admin.

**Moderation.** A network's admins can suspend one of their own members, which
stops them posting and notifies the Hub. Only the Hub can ban an account, from
`/hub/moderation`. Neither deletes anything, and neither closes the reporting
route: someone barred from the community can still file a report.

**Architecture and decisions** are written up in `MERGE.md`.
