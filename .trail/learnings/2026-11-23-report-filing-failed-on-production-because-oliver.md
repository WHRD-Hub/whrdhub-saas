---
title: Report filing failed on production because the encryption keys were never added to Vercel
author: Oliver
date: 2026-11-23
branch: feat/permanent-file-links
cost: { minutes: 1, tokens: 1750 }
id: l-3d02ce14
scope: repo
status: active
replaces: l-1eb702e0
src: agent
touches:
  - app/actions/report-submit.ts
  - lib/crypto.ts
  - lib/alerts.ts
  - lib/rate-limit.ts
  - lib/abuse-profiles.ts
---

## Decided
- Refuse a report before anything is written when the encryption keys are missing or malformed. Encryption runs after the anonymous account is created, so a late failure left an account with no report.
- Show reporters a plain message for unexpected submit failures, because production masks server action errors as React error 441.
- Reuse the existing local keys on Vercel, because local and production share one Neon database and must decrypt the same rows.
- Test production filing with a non-critical incident type and "No rush", because critical types or "immediate" urgency alert staff.

## Tried and ruled out
- Treating React error 441 as the cause: it only masks an exception thrown in a server action. The Vercel function log showed the real error, "DATA_ENCRYPTION_KEYS is not set".

## Watch out
- A browser test report stores that browser's location when geolocation is allowed, so delete test reports afterwards.
- Linking the Vercel project rewrites the local env file and edits the gitignore file. Check both afterwards.
- Vercel environment changes only apply after a redeploy.
- The production rate limiter logs "not allowed" and lets requests through, so limits are not enforced until that is fixed.

In the code:
- app/actions/report-submit.ts: submitReport calls encryptionConfigured before account creation.
- lib/crypto.ts: encryptionConfigured checks DATA_ENCRYPTION_KEYS and BLIND_INDEX_KEY.
- lib/alerts.ts: alertOnReport decides which reports alert staff.
- lib/rate-limit.ts: rateLimit fails open when the rate_limit_hit call is refused.
