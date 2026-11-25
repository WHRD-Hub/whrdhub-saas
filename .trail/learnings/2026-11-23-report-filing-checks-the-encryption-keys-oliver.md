---
title: Report filing checks the encryption keys before creating any account
author: Oliver
date: 2026-11-23
branch: feat/permanent-file-links
cost: { minutes: 5, tokens: 136178 }
id: l-1eb702e0
scope: repo
status: active
src: agent
touches:
  - lib/crypto.ts
  - app/actions/report-submit.ts
  - components/reporting/report-form.tsx
  - lib/rate-limit.ts
  - lib/report-crypto.ts
  - lib/supabase/admin.ts
  - components/pwa/offline-sync-manager.tsx
---

## Decided
- Refuse a report before anything is written when the encryption keys are missing or malformed. Encryption runs after the anonymous account is created, so a late failure left an account with no report and showed the reporter a bare React error.
- Show reporters a plain message for unexpected submit failures, because production replaces server action errors with React error 441 and the text means nothing to someone reporting abuse.

## Tried and ruled out
- Reading the React 441 message as the cause: it is only the production mask for any exception thrown in a server action, so the real error has to come from the server log or the code path.

## Watch out
- Missing production keys are the likely cause of the November 2026 failure, not a confirmed one: Vercel settings and logs could not be read at the time. The database showed 0 reports and 5 anonymous accounts without a report.
- Local and production use the same Neon database, so they must share the same encryption and blind index keys.
- Environment changes on Vercel only apply after a redeploy.

In the code:
- app/actions/report-submit.ts: submitReport calls encryptionConfigured before createClient and account creation.
- lib/crypto.ts: encryptionConfigured checks DATA_ENCRYPTION_KEYS and BLIND_INDEX_KEY.
- components/reporting/report-form.tsx: handleSubmit catch block shows the plain message.
