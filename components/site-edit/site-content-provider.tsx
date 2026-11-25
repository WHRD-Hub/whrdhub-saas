"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  discardDrafts,
  publishDrafts,
  saveDraft,
  setEditMode,
  type EditResult,
} from "@/app/actions/site-content";

/**
 * What the public pages show in place of the wording and photos written in their
 * code, and, for a Hub super administrator, edit mode.
 *
 * Every visitor gets `published` from the server. A super administrator's page
 * also loads their drafts (see SiteEditorBoot); while edit mode is on they see
 * and change the drafts, and nothing reaches visitors until they press Publish.
 */
type Values = Record<string, string | null>;

interface EditorData {
  draft: Values;
  published: Values;
}

interface SiteContentState {
  /** The value to show for a spot: a string, null for "the page's own", undefined for unchanged. */
  valueFor: (key: string) => string | null | undefined;
  /** A super administrator is signed in and their drafts are loaded. */
  canEdit: boolean;
  /** Edit mode is on: spots are editable and show drafts. */
  editing: boolean;
  /** Keys whose draft differs from what is live. */
  pending: string[];
  isPending: (key: string) => boolean;
  save: (key: string, kind: "text" | "image", value: string | null) => Promise<EditResult>;
  setEditing: (on: boolean) => Promise<EditResult>;
  publish: () => Promise<EditResult & { count?: number }>;
  discard: () => Promise<EditResult>;
  /** Called once by SiteEditorBoot with the drafts it loaded. */
  activate: (data: EditorData, editing: boolean) => void;
}

const Ctx = createContext<SiteContentState | null>(null);

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? null) === (b ?? null);

export function SiteContentProvider({ published, children }: { published: Record<string, string>; children: ReactNode }) {
  const [editor, setEditor] = useState<EditorData | null>(null);
  const [editing, setEditingState] = useState(false);

  const activate = useCallback((data: EditorData, on: boolean) => {
    setEditor(data);
    setEditingState(on);
  }, []);

  const valueFor = useCallback(
    (key: string) => {
      if (editor && editing) return key in editor.draft ? editor.draft[key] : undefined;
      if (editor) return key in editor.published ? editor.published[key] : undefined;
      return key in published ? published[key] : undefined;
    },
    [editor, editing, published],
  );

  const pending = useMemo(() => {
    if (!editor) return [];
    const keys = new Set([...Object.keys(editor.draft), ...Object.keys(editor.published)]);
    return [...keys].filter((k) => !same(editor.draft[k], editor.published[k]));
  }, [editor]);

  const isPending = useCallback((key: string) => pending.includes(key), [pending]);

  const save = useCallback(async (key: string, kind: "text" | "image", value: string | null) => {
    const res = await saveDraft(key, kind, value);
    if (res.ok) setEditor((e) => (e ? { ...e, draft: { ...e.draft, [key]: value } } : e));
    return res;
  }, []);

  const setEditing = useCallback(async (on: boolean) => {
    const res = await setEditMode(on);
    if (res.ok) setEditingState(on);
    return res;
  }, []);

  const publish = useCallback(async () => {
    const res = await publishDrafts();
    if (res.ok) setEditor((e) => (e ? { draft: { ...e.draft }, published: { ...e.draft } } : e));
    return res;
  }, []);

  const discard = useCallback(async () => {
    const res = await discardDrafts();
    if (res.ok) setEditor((e) => (e ? { draft: { ...e.published }, published: e.published } : e));
    return res;
  }, []);

  const value = useMemo<SiteContentState>(
    () => ({ valueFor, canEdit: !!editor, editing: !!editor && editing, pending, isPending, save, setEditing, publish, discard, activate }),
    [valueFor, editor, editing, pending, isPending, save, setEditing, publish, discard, activate],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteContent(): SiteContentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSiteContent must be used inside SiteContentProvider");
  return ctx;
}
