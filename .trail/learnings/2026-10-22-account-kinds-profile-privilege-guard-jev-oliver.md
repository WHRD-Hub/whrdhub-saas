---
title: "Account kinds, profile privilege guard, Jev via OpenRouter, watched listening sources"
author: Oliver
date: 2026-10-22
branch: reporting-overhaul
cost: { minutes: 10, tokens: 130601 }
touches:
  - app/globals.css
  - components/accessibility-controls.tsx
  - components/pwa/offline-sync-manager.tsx
  - components/reporting/report-form.tsx
  - components/reporting/voice-input.tsx
  - lib/offline/outbox.ts
  - lib/offline/report-queue.ts
  - app/api/ussd/route.ts
  - app/actions/report-update.ts
  - "app/hub/reporting/reports/[id]/page.tsx"
---

## Decided
- Three ways to join live in profiles.account_kind (anonymous, reporter, member). current-user.isReporterOnly uses it, falling back to the old rule for rows without one. Signup never sends user_type.
- Staff roles come only from an administrator. handle_new_user ignores client metadata for roles, and trg_profiles_guard blocks non-admins changing is_hub_admin, user_type, banned_at, ban_reason (service role has auth.uid() null and passes). The old profiles_own policy let anyone promote themselves; the trigger is the fix, not the policy.
- Jev goes through OpenRouter first (typesafe/jev-1.13, state {text}), TypeSafe's own API second; TypeSafe's key returned 401 but the OpenRouter route works. No general LLM is used.
- Watched Instagram accounts and hashtags (listening_sources) are scanned by the daily cron; three captured posts naming one account in a day triggers a staff warning.
- Crons are daily (vercel.json); escalate-reports re-raises anything unacknowledged each run.
- USSD: menu 1 new report, 2 check with a 4-digit PIN (hashed with phone number, locked after 5 wrong tries); new-report indexes start at 2 because of the menu.

## Tried and ruled out
- Watching X accounts: no free timeline API; X is link-scan only.
- Auto-demoting existing "defender" profiles: cannot tell real staff from ordinary members, so an audit query is left in migration 018 instead.

## Watch out
- Existing user_type 'defender' accounts still have console access until an admin audits them.
- An offline anonymous report is submitted later but its username is never shown to the reporter.
- Migrations 016-018 must be applied; most code tolerates missing columns, alerts and watched sources do not.
- Heavy scripts in the shell tool: write a python file and run it; a script that fails midway leaves earlier edits applied, so check before re-running.
