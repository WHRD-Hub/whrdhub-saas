export interface Keyword { id: string; word: string; severity: string; active: boolean }

export interface Result {
  id: string;
  source: string;
  permalink: string | null;
  author: string | null;
  content: string;
  matched_keywords: string[];
  severity: string;
  status: string;
  captured_at: string;
  ai_class?: string | null;
  ai_confidence?: number | null;
  /** The admin who last took this on or closed it, so colleagues do not duplicate the work. */
  handled_by_name?: string | null;
  handled_at?: string | null;
  /** The case this capture became when it was taken on. */
  report_id?: string | null;
}

/** One page of the inbox, as the server filtered it, with the counts that go with it. */
export interface InboxData {
  results: Result[];
  total: number;
  page: number;
  pageSize: number;
  status: string;
  /** Captures in each status, ignoring the other filters. */
  counts: Record<string, number>;
  /** New captures that look like real cases. */
  likelyNew: number;
}

export type ActionResult =
  | { error?: string; ok?: boolean; stored?: number; existing?: number; scanned?: number; added?: number; problems?: string[]; reportId?: string }
  | undefined;

/** Runs a server action with a busy flag, a toast for the outcome, and a refresh of the page data. */
export type Run = (tag: string, fn: () => Promise<ActionResult>) => Promise<ActionResult>;

export const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", x: "X", facebook: "Facebook" };

export const AI_LABEL: Record<string, { label: string; cls: string }> = {
  real_incident: { label: "Likely a real case", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  missing_person: { label: "Missing person", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  targeted_abuse: { label: "Abuse aimed at someone", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  awareness: { label: "Awareness or news", cls: "bg-cyan-050 text-cyan-700 border-cyan/30" },
  not_relevant: { label: "Likely not relevant", cls: "bg-slate-50 text-slate-500 border-slate-200" },
};

export const isLikelyReal = (c?: string | null) => c === "real_incident" || c === "missing_person" || c === "targeted_abuse";

/** Severity as a small coloured dot, so a list can be scanned without reading badges. */
export const SEVERITY_DOT: Record<string, string> = { high: "bg-rose-500", medium: "bg-amber-500", low: "bg-slate-300" };
