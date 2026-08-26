import { BookOpen, FileText, Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReviewControls } from "@/components/hub/review-controls";
import { Avatar } from "@/components/ui/field";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Review queue — WHRD Hub" };

async function authorNames(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
  for (const p of data ?? []) map.set(p.id as string, (p.full_name as string) || (p.username as string) || "WHRD member");
  return map;
}

export default async function ReviewQueue() {
  const supabase = await createClient();

  const [{ data: posts }, { data: blogs }] = await Promise.all([
    supabase.from("posts").select("id, author_id, body, image_urls, pinned, created_at, county_networks(name)").eq("status", "pending").order("created_at"),
    supabase.from("blogs").select("id, author_id, title, excerpt, cover_image_url, pinned, created_at, county_networks(name)").eq("status", "pending").order("created_at"),
  ]);

  const ids = [
    ...(posts ?? []).map((p) => p.author_id),
    ...(blogs ?? []).map((b) => b.author_id),
  ].filter(Boolean) as string[];
  const names = await authorNames(supabase, Array.from(new Set(ids)));

  const county = (v: unknown) =>
    Array.isArray(v) ? (v[0] as { name: string })?.name : (v as { name: string } | null)?.name;

  const empty = !posts?.length && !blogs?.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-ink">Review queue</h1>
        <p className="text-sm text-muted mt-1">
          Fact-check and approve what defenders submit before it reaches the public feed. This mirrors
          the reporting platform&apos;s verification flow.
        </p>
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
          <Inbox className="w-8 h-8 text-purple mx-auto" />
          <p className="mt-3 font-semibold text-ink">You are all caught up</p>
          <p className="text-sm text-muted">Nothing is waiting for review right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {blogs?.map((b) => (
            <article key={b.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <Avatar name={names.get(b.author_id!) ?? "WHRD"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{names.get(b.author_id!) ?? "WHRD member"}</p>
                  <p className="text-xs text-muted">Story · {county(b.county_networks) ?? "—"} · {timeAgo(b.created_at)}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple bg-purple-050 px-2 py-0.5 rounded-full"><BookOpen className="w-3 h-3" /> Story</span>
              </div>
              <h3 className="mt-3 font-bold text-ink">{b.title}</h3>
              {b.excerpt && <p className="text-sm text-muted mt-1">{b.excerpt}</p>}
              {b.cover_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.cover_image_url} alt="" className="mt-3 rounded-xl border border-line max-h-56 object-cover w-full" />
              )}
              <ReviewControls kind="blog" id={b.id} pinned={b.pinned} title={b.title as string} excerpt={(b.excerpt as string) ?? ""} body="" />
            </article>
          ))}

          {posts?.map((p) => (
            <article key={p.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <Avatar name={names.get(p.author_id!) ?? "WHRD"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{names.get(p.author_id!) ?? "WHRD member"}</p>
                  <p className="text-xs text-muted">Post · {county(p.county_networks) ?? "—"} · {timeAgo(p.created_at)}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-050 px-2 py-0.5 rounded-full"><FileText className="w-3 h-3" /> Post</span>
              </div>
              <p className="mt-3 text-sm text-ink whitespace-pre-wrap">{p.body}</p>
              {p.image_urls?.[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_urls[0]} alt="" className="mt-3 rounded-xl border border-line max-h-56 object-cover w-full" />
              )}
              <ReviewControls kind="post" id={p.id} pinned={p.pinned} body={p.body as string} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
