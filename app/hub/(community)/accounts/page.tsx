import { UserX, FileText, BookOpen, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { DeletedActions } from "@/components/hub/deleted-actions";

export const metadata = { title: "Deleted accounts — WHRD Hub" };

/**
 * Accounts people have closed, and what was in them.
 *
 * The auth user and the content are deliberately retained: an account closing
 * must not erase the Hub's ability to answer a safeguarding question later.
 * Nothing here is visible to any other member.
 */
export default async function DeletedAccountsPage() {
  // Service role throughout: a deleted profile is invisible under RLS by
  // design, including to admins reading through the normal client.
  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, full_name, username, email, avatar_url, title, user_type, is_anonymous, account_deleted_at, account_deleted_reason",
    )
    .not("account_deleted_at", "is", null)
    .order("account_deleted_at", { ascending: false });

  const list = profiles ?? [];
  const ids = list.map((p) => p.id as string);

  const counts = new Map<string, { posts: number; blogs: number; reports: number }>();
  for (const id of ids) counts.set(id, { posts: 0, blogs: 0, reports: 0 });

  if (ids.length) {
    const [{ data: posts }, { data: blogs }, { data: reports }] = await Promise.all([
      admin.from("posts").select("author_id").in("author_id", ids),
      admin.from("blogs").select("author_id").in("author_id", ids),
      admin.from("reports").select("user_id").in("user_id", ids),
    ]);
    for (const p of posts ?? []) {
      const c = counts.get(p.author_id as string);
      if (c) c.posts += 1;
    }
    for (const b of blogs ?? []) {
      const c = counts.get(b.author_id as string);
      if (c) c.blogs += 1;
    }
    for (const r of reports ?? []) {
      const c = counts.get(r.user_id as string);
      if (c) c.reports += 1;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <UserX className="h-6 w-6 text-purple" /> Deleted accounts
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          People who have closed their account. Their profile and content are hidden from
          everyone else but kept here. Restoring brings the account back; permanent
          deletion removes the person and everything attached to them for good.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <UserX className="mx-auto h-8 w-8 text-purple" />
          <p className="mt-3 font-semibold text-ink">No accounts have been deleted</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((p) => {
            const c = counts.get(p.id as string) ?? { posts: 0, blogs: 0, reports: 0 };
            const name =
              (p.full_name as string) || (p.username as string) || "Former member";
            return (
              <li key={p.id as string} className="flex flex-wrap items-start gap-3 p-4">
                <Avatar name={name} src={p.avatar_url as string | null} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {(p.email as string) || "no address"}
                    {p.title ? ` · ${p.title as string}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Deleted {timeAgo(p.account_deleted_at as string)}
                    {p.account_deleted_reason
                      ? ` · "${p.account_deleted_reason as string}"`
                      : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.is_anonymous ? <Pill tone="slate">Anonymous reporter</Pill> : null}
                    {c.posts > 0 && (
                      <Pill tone="cyan">
                        <FileText className="h-3 w-3" /> {c.posts} post{c.posts === 1 ? "" : "s"}
                      </Pill>
                    )}
                    {c.blogs > 0 && (
                      <Pill tone="purple">
                        <BookOpen className="h-3 w-3" /> {c.blogs} stor{c.blogs === 1 ? "y" : "ies"}
                      </Pill>
                    )}
                    {c.reports > 0 && (
                      <Pill tone="magenta">
                        <ShieldCheck className="h-3 w-3" /> {c.reports} report
                        {c.reports === 1 ? "" : "s"}
                      </Pill>
                    )}
                  </div>
                </div>
                <DeletedActions target={{ type: "account", id: p.id as string, label: name }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
