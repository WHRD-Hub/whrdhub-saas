"use client";

import { useState, useTransition } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/field";
import { timeAgo } from "@/lib/utils";
import { addComment } from "@/app/actions/comments";
import { deleteOwnContent, adminSoftDelete } from "@/app/actions/lifecycle";
import { toast } from "@/components/ui/toast";
import { promptSignIn } from "@/lib/guest-reactions";
import type { FeedComment } from "@/lib/feed";

/**
 * Comments under a feed post.
 *
 * Commenting needs an account, unlike supporting a post. New comments appear
 * immediately and are reconciled with the server id when the action returns,
 * so the thread never feels laggy on a slow connection.
 */
export function CommentThread({
  postId,
  initial,
  signedIn,
  isHubAdmin = false,
  onCountChange,
}: {
  postId: string;
  initial: FeedComment[];
  signedIn: boolean;
  isHubAdmin?: boolean;
  onCountChange?: (n: number) => void;
}) {
  const [comments, setComments] = useState<FeedComment[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  const update = (next: FeedComment[]) => {
    setComments(next);
    onCountChange?.(next.length);
  };

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    if (!signedIn) {
      promptSignIn("comment");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic: FeedComment = {
      id: tempId,
      body,
      author: { id: null, name: "You", title: null, avatar_url: null },
      created_at: new Date().toISOString(),
      mine: true,
    };
    update([...comments, optimistic]);
    setDraft("");

    startTransition(async () => {
      const res = await addComment(postId, body);
      if (res?.error) {
        // Roll the optimistic comment back out and hand the text back so the
        // person does not lose what they wrote.
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setDraft(body);
        toast.error(res.error);
        return;
      }
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? { ...c, id: res.id ?? c.id } : c)),
      );
    });
  };

  const remove = (c: FeedComment) => {
    const before = comments;
    update(comments.filter((x) => x.id !== c.id));
    startTransition(async () => {
      const res = c.mine
        ? await deleteOwnContent("comment", c.id)
        : await adminSoftDelete("comment", c.id);
      if (res?.error) {
        update(before);
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="border-t border-line bg-paper/60 px-3 py-3">
      {comments.length === 0 && (
        <p className="px-1 pb-2 text-xs text-muted">
          No comments yet. Be the first to say something.
        </p>
      )}

      <ul className="space-y-2.5">
        {comments.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Avatar name={c.author.name} src={c.author.avatar_url} size={32} />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl bg-surface px-3 py-2">
                <p className="text-[13px] font-semibold text-ink">{c.author.name}</p>
                <p className="whitespace-pre-wrap text-sm leading-snug text-ink/90">{c.body}</p>
              </div>
              <p className="mt-1 flex items-center gap-3 px-3 text-[11px] text-muted">
                <span>{timeAgo(c.created_at)}</span>
                {(c.mine || isHubAdmin) && (
                  <button
                    onClick={() => remove(c)}
                    className="inline-flex items-center gap-1 font-semibold hover:text-rose-600 hover:underline"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-start gap-2">
        <Avatar name="You" size={32} />
        <div className="relative flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={signedIn ? "Write a comment…" : "Sign in to comment"}
            aria-label="Write a comment"
            className="w-full resize-none rounded-2xl border border-line bg-surface py-2.5 pl-3.5 pr-11 text-sm text-ink placeholder:text-muted focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
          <button
            onClick={submit}
            disabled={pending || !draft.trim()}
            aria-label="Post comment"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-purple transition-colors hover:bg-purple-050 disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

    </div>
  );
}
