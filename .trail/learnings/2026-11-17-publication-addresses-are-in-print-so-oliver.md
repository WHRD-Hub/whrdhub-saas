---
title: "Publication addresses are in print, so files go back to the same bucket and key and the record of them is kept in the repo"
author: Oliver
date: 2026-11-17
branch: feat/permanent-file-links
cost: { minutes: 6, tokens: 168636 }
id: l-1234c4ac
scope: repo
status: active
src: agent
touches:
  - lib/file-url.ts
  - lib/file-links.ts
  - "app/files/[...path]/route.ts"
  - scripts/file-links.mjs
  - data/file-links.md
  - lib/storage.ts
---

## Decided
The addresses of the Hub's publications are on printed material, so they are permanent. The permanent form is the site's own address, /files/<bucket>/<key>; the storage service behind it can change. All 49 public files from the Supabase days are recorded with their exact keys. Files that are sent back get uploaded to those same keys with a script, not through the Hub's publication form. Database rows keep the old Supabase form of the address on purpose; it is mapped to /files when a page is drawn.

## Tried and ruled out
Rewriting the saved addresses in the database to the new form: unnecessary, and it would lose the proof of what the original address was.
Relying on NEXT_PUBLIC_SUPABASE_URL to recognise old addresses: removing that variable (a pending clean-up) would have sent every link back to supabase.co. The old host is now recognised by name.

## Watch out
Uploading a returned file through the publication form gives it a new key and so a new address. Use the script.
An address printed in the supabase.co form cannot be served by this site at all; only the Supabase project can answer it. Do not delete that project until the printed material has been checked.
The redirect for a replaced document (old address leads to the new file) was not exercised end to end, because that needs a production row changed.

In the code: data/file-links.json (the record), scripts/file-links.mjs (check, restore), lib/file-links.ts (isPrintedFile, movedTo), lib/file-url.ts (LEGACY_STORAGE_HOST), lib/storage.ts (removeFromBucket never deletes a recorded file), data/file-links.md.
