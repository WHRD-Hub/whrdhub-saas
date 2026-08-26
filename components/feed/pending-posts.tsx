"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, Loader2, Send, Trash2, WifiOff } from "lucide-react";
import { Avatar } from "@/components/ui/field";
import { timeAgo } from "@/lib/utils";
import { useOnline } from "@/lib/use-online";
import {
  getOutbox,
  removeFromOutbox,
  OUTBOX_CHANGED_EVENT,
  type OutboxItem,
  type QueuedPost,
} from "@/lib/offline/outbox";
import { flushOutbox } from "@/components/pwa/offline-sync-manager";

/**
 * Posts written on this device that have not gone out yet.
 *
 * They sit at the top of the feed looking like posts, marked "Sending", the
 * way an unsent message does in a chat app. Nobody else can see them, and they
 * leave this list the moment they reach the server.
 */
export function PendingPosts({
  userName,
  avatarUrl,
}: {
  userName?: string | null;
  avatarUrl?: string | null;
}) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sending, setSending] = useState(false);
  const online = useOnline();

  const load = useCallback(() => {
    void getOutbox("post").then(setItems);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(OUTBOX_CHANGED_EVENT, load);
    return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, load);
  }, [load]);

  if (items.length === 0) return null;

  const sendNow = async () => {
    setSending(true);
    await flushOutbox();
    setSending(false);
    load();
  };

  const discard = async (localId: string) => {
    await removeFromOutbox(localId);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
        {online ? (
          <CloudOff className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="flex-1">
          <span className="font-bold">
            {items.length} {items.length === 1 ? "post is" : "posts are"} waiting to send.
          </span>{" "}
          {online
            ? "Sending now."
            : "They are saved on this device and will send themselves when you are back online."}
        </span>
        {online && (
          <button
            onClick={sendNow}
            disabled={sending}
            className="inline-flex items-center gap-1 font-bold hover:underline disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Retry
          </button>
        )}
      </div>

      {items.map((item) => {
        const post = item.payload as QueuedPost;
        return (
          <article
            key={item.localId}
            className="overflow-hidden rounded-xl border border-dashed border-amber-300 bg-surface opacity-90"
          >
            <header className="flex items-start gap-2.5 p-3 pb-2">
              <Avatar name={userName ?? "You"} src={avatarUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-ink">{userName || "You"}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-700">
                  <Loader2 className={online ? "h-3 w-3 animate-spin" : "hidden"} />
                  <span className="font-semibold">
                    {online ? "Sending…" : "Waiting for a connection"}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="text-muted">written {timeAgo(new Date(item.createdAt))}</span>
                </p>
              </div>
              <button
                onClick={() => discard(item.localId)}
                aria-label="Discard this unsent post"
                className="rounded-full p-1.5 text-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </header>
            <p className="whitespace-pre-wrap px-4 pb-4 text-[15px] leading-relaxed text-ink">
              {post.body}
            </p>
            {item.lastError && item.attempts > 1 && (
              <p className="border-t border-line bg-paper px-4 py-2 text-xs text-muted">
                Last attempt did not go through: {item.lastError}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
