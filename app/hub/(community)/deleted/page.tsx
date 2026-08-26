import { Trash2, FileText, BookOpen, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pill } from "@/components/ui/pill";
import { timeAgo } from "@/lib/utils";
import { DeletedActions } from "@/components/hub/deleted-actions";
import type { ContentKind } from "@/app/actions/lifecycle";

export const metadata = { title: "Deleted content — WHRD Hub" };

interface Item {
  kind: ContentKind;
  id: string;
  label: string;
  authorId: string | null;
  deletedAt: string;
  deletedBy: string | null;
  reason: string | null;
  status: string | null;
}

const ICON: Record<string, typeof FileText> = { post: FileText, blog: BookOpen, comment: MessageCircle };
const KIND_LABEL: Record<string, string> = { post: "Post", blog: "Story", comment: "Comment" };

/**
 * Everything members and admins have deleted, kept where the Hub can still
 * read it. Restoring puts an item back exactly where it was; purging is the
 * only thing here that actually destroys data.
 */
export default async function DeletedContentPage() {
  const supabase = await createClient();

  const [{ data: posts }, { data: blogs }, { data: comments }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, body, author_id, status, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("blogs")
      .select("id, title, author_id, status, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("post_comments")
      .select("id, body, author_id, deleted_at, deleted_by, deleted_reason")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const items: Item[] = [
    ...(posts ?? []).map((p) => ({
      kind: "post" as const,
      id: p.id as string,
      label: ((p.body as string) || "Untitled post").slice(0, 140),
      authorId: (p.author_id as string) ?? null,
      deletedAt: p.deleted_at as string,
      deletedBy: (p.deleted_by as string) ?? null,
      reason: (p.deleted_reason as string) ?? null,
      status: (p.status as string) ?? null,
    })),
    ...(blogs ?? []).map((b) => ({
      kind: "blog" as const,
      id: b.id as string,
      label: (b.title as string) || "Untitled story",
      authorId: (b.author_id as string) ?? null,
      deletedAt: b.deleted_at as string,
      deletedBy: (b.deleted_by as string) ?? null,
      reason: (b.deleted_reason as string) ?? null,
      status: (b.status as string) ?? null,
    })),
    ...(comments ?? []).map((c) => ({
      kind: "comment" as const,
      id: c.id as string,
      label: ((c.body as string) || "Comment").slice(0, 140),
      authorId: (c.author_id as string) ?? null,
      deletedAt: c.deleted_at as string,
      deletedBy: (c.deleted_by as string) ?? null,
      reason: (c.deleted_reason as string) ?? null,
      status: null,
    })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  // Names for authors and deleters, including accounts that are themselves
  // deleted, which is why this uses the service role.
  const admin = createAdminClient();
  const ids = Array.from(
    new Set(items.flatMap((i) => [i.authorId, i.deletedBy]).filter(Boolean)),
  ) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ids);
    for (const p of data ?? []) {
      names.set(p.id as string, (p.full_name as string) || (p.username as string) || "Member");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <Trash2 className="h-6 w-6 text-purple" /> Deleted content
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Posts, stories and comments that members or the Hub have deleted. They are gone
          from the feed but kept here. Only permanent deletion destroys anything.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <Trash2 className="mx-auto h-8 w-8 text-purple" />
          <p className="mt-3 font-semibold text-ink">Nothing has been deleted</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.map((item) => {
            const Icon = ICON[item.kind];
            const author = item.authorId ? names.get(item.authorId) : null;
            const deleter = item.deletedBy ? names.get(item.deletedBy) : null;
            const byAuthor = !!item.authorId && item.authorId === item.deletedBy;
            return (
              <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-start gap-3 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="font-semibold">{KIND_LABEL[item.kind]}</span>
                    <span aria-hidden>·</span>
                    <span>by {author ?? "a former member"}</span>
                    <span aria-hidden>·</span>
                    <span>
                      deleted {timeAgo(item.deletedAt)}
                      {byAuthor ? " by the author" : deleter ? ` by ${deleter}` : ""}
                    </span>
                  </p>
                  {item.reason && (
                    <p className="mt-1 text-xs italic text-muted">&ldquo;{item.reason}&rdquo;</p>
                  )}
                </div>
                {item.status && item.status !== "approved" && (
                  <Pill tone="slate">{item.status}</Pill>
                )}
                <DeletedActions
                  target={{ type: "content", kind: item.kind, id: item.id, label: item.label }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
