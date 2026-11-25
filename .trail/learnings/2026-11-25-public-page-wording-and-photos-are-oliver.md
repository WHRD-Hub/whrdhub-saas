---
title: "Public page wording and photos are edited in place by super admins, as drafts published in one go"
author: Oliver
date: 2026-11-25
branch: feat/permanent-file-links
cost: { minutes: 13, tokens: 196860 }
id: l-e632c0dd
scope: repo
status: active
src: agent
touches:
  - supabase/025_site_content.sql
  - lib/site-content-store.ts
  - app/actions/site-content.ts
  - components/site-edit/site-content-provider.tsx
  - components/site-edit/site-editor-boot.tsx
  - components/site-edit/editable-text.tsx
  - components/site-edit/editable-image.tsx
  - components/site-edit/edit-image-dialog.tsx
  - components/site-edit/edit-bar.tsx
  - components/site-header.tsx
---

## Decided
- Edit mode is for profiles.is_hub_admin only (not user_type admin). Every server action re-checks it; the browser's claim counts for nothing.
- A page keeps its own wording in code as the default. The table holds only what was changed, keyed by a stable id, so a missing row means "show the code".
- Changes are drafts until Publish, as in the ccj site. Published content is cached for everyone and refreshed by updateTag on publish, so visitors cost no database read per page.
- Photos go to the publications bucket under site/ (Hub admins only) and must be /files/publications/site/ addresses, so a draft can never point the site at another server.

## Watch out
- Changing an id in code orphans the edits saved under it. Ids made from the default wording (About page headings) break if that wording is edited in code.
- The landing page sends signed-in people to their dashboard. A super admin must turn on edit mode from another page first; the edit cookie then lets them stay on the home page.
- The local server uses the production database, so drafts and publishes made locally are real.

In the code:
- supabase/025_site_content.sql (applied 25 Nov 2026), lib/site-content-store.ts, app/actions/site-content.ts.
- components/site-edit/ (EditableText, EditableImage, EditImageDialog, EditBar); components/site-header.tsx boots edit mode; components/page-hero.tsx takes editKey.
