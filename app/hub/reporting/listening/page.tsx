import { createAdminClient } from "@/lib/supabase/admin";
import { ListeningView } from "@/components/reporting/listening/listening-view";
import type { InboxData, Keyword, Result } from "@/components/reporting/listening/types";
import type { Source } from "@/lib/listening-sources";
import { ensurePacks } from "@/lib/listening-packs";

export const metadata = { title: "Online Listening - WHRD Hub" };

const PAGE_SIZE = 40;
const STATUSES = ["new", "reviewing", "actioned", "dismissed"];
const LIKELY = ["real_incident", "missing_person", "targeted_abuse"];

export default async function ListeningPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // Access is enforced by app/hub/reporting/layout.tsx.
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? (sp.status as string) : "new";
  const page = Math.max(1, parseInt(sp.page || "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const q = sp.q?.trim().slice(0, 80);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Filtering, searching and paging happen in the database, so the inbox stays quick however many captures arrive.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listQuery = (cols: string): any => {
    let query = db.from("listening_results").select(cols, { count: "exact" }).eq("status", status);
    if (sp.platform) query = query.eq("source", sp.platform);
    if (sp.severity) query = query.eq("severity", sp.severity);
    if (sp.label === "likely") query = query.in("ai_class", LIKELY);
    else if (sp.label === "missing") query = query.eq("ai_class", "missing_person");
    else if (sp.label === "awareness") query = query.eq("ai_class", "awareness");
    if (q) {
      // Characters that mean something inside a PostgREST filter are dropped rather than escaped.
      const safe = q.replace(/[,()%*\\]/g, " ").trim();
      if (safe) query = query.or(`content.ilike.%${safe}%,author.ilike.%${safe}%`);
    }
    return query.order("captured_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  };

  // Columns added by later migrations are tried first and dropped if the database does not have them yet.
  const base = "id, source, permalink, author, content, matched_keywords, severity, status, captured_at";
  const attempts = [
    `${base}, ai_class, ai_confidence, handled_by, handled_at, report_id`,
    `${base}, ai_class, ai_confidence, handled_by, handled_at`,
    `${base}, ai_class, ai_confidence`,
    base,
  ];
  let rows: Record<string, unknown>[] = [];
  let total = 0;
  for (const cols of attempts) {
    const { data, error, count } = await listQuery(cols);
    if (!error) { rows = data ?? []; total = count ?? 0; break; }
  }

  const head = () => db.from("listening_results").select("id", { count: "exact", head: true });
  const [newC, revC, actC, disC, likelyC] = await Promise.all([
    head().eq("status", "new"),
    head().eq("status", "reviewing"),
    head().eq("status", "actioned"),
    head().eq("status", "dismissed"),
    head().eq("status", "new").in("ai_class", LIKELY),
  ]);
  const counts = { new: newC.count ?? 0, reviewing: revC.count ?? 0, actioned: actC.count ?? 0, dismissed: disC.count ?? 0 };

  const ids = [...new Set(rows.map((r) => r.handled_by as string | null).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await db.from("profiles").select("id, full_name, username").in("id", ids);
    for (const p of (people ?? []) as { id: string; full_name: string | null; username: string | null }[]) names.set(p.id, p.full_name || p.username || "a colleague");
  }
  const results: Result[] = rows.map((r) => ({ ...(r as unknown as Result), handled_by_name: r.handled_by ? names.get(r.handled_by as string) ?? "a colleague" : null }));

  // The preset packs (Usikimye, Political) add their accounts and words the first time they are seen.
  const packs = await ensurePacks();

  const srcBase = "id, platform, kind, handle, note, active, last_scanned_at, last_result";
  const withPack = await db.from("listening_sources").select(`${srcBase}, index_all, pack`).order("created_at", { ascending: false });
  // Until migrations 018 and 020 are applied the table or columns may be missing; show what exists rather than fail.
  const sources = withPack.error ? (await db.from("listening_sources").select(srcBase).order("created_at", { ascending: false })).data : withPack.data;
  const { data: keywords } = await db.from("listening_keywords").select("id, word, severity, active").order("word");

  const inbox: InboxData = { results, total, page, pageSize: PAGE_SIZE, status, counts, likelyNew: likelyC.count ?? 0 };
  return <ListeningView sources={(sources ?? []) as Source[]} keywords={(keywords ?? []) as Keyword[]} inbox={inbox} packs={packs ?? []} />;
}
