"use client";

import { useEffect } from "react";
import { getEditorState } from "@/app/actions/site-content";
import { useSiteContent } from "./site-content-provider";

/**
 * Rendered by the site header only for a Hub super administrator. Loads their
 * drafts so edit mode can start. Visitors never get this, so they never pay for
 * the extra request.
 */
export function SiteEditorBoot({ editing }: { editing: boolean }) {
  const { activate, canEdit } = useSiteContent();

  useEffect(() => {
    if (canEdit) return;
    let live = true;
    getEditorState()
      .then((s) => {
        if (live && s.canEdit) activate({ draft: s.draft, published: s.published }, editing);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [activate, canEdit, editing]);

  return null;
}
