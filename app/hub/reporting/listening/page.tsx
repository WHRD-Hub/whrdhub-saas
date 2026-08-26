import { createAdminClient } from "@/lib/supabase/admin";
import { metaConfigured } from "@/lib/meta";
import { ListeningView, type Keyword, type Result } from "@/components/reporting/listening/listening-view";

export const metadata = { title: "Online Listening - WHRD Hub" };

export default async function ListeningPage() {
  // Access is enforced by app/hub/reporting/layout.tsx.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const [{ data: keywords }, { data: results }] = await Promise.all([
    db.from("listening_keywords").select("id, word, severity, active").order("word"),
    db.from("listening_results").select("id, source, permalink, author, content, matched_keywords, severity, status, captured_at").order("captured_at", { ascending: false }).limit(100),
  ]);

  return (
    <ListeningView
      connected={metaConfigured()}
      keywords={(keywords ?? []) as Keyword[]}
      results={(results ?? []) as Result[]}
    />
  );
}
