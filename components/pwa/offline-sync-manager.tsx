"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { submitReport, type ReportData } from "@/app/actions/report-submit";
import { createPost } from "@/app/actions/content";
import {
  getOutbox,
  removeFromOutbox,
  updateOutboxItem,
  OUTBOX_CHANGED_EVENT,
  type OutboxItem,
  type QueuedPost,
} from "@/lib/offline/outbox";

// Kept under the old name for the report form, which imports it to nudge the UI.
export const QUEUE_CHANGED_EVENT = OUTBOX_CHANGED_EVENT;

let flushing = false;

/**
 * Send everything waiting in the outbox. Safe to call repeatedly.
 *
 * Items are attempted oldest first so a queue drains in the order it was
 * written. A report that needs a session it does not have yet is left where it
 * is rather than being discarded — the person may simply not have signed back
 * in. Anything else that fails keeps its error and is retried on the next
 * trigger.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;

  let reportsSent = 0;
  let postsSent = 0;

  try {
    const queue = await getOutbox();
    for (const item of queue) {
      try {
        if (item.kind === "report") {
          const result = await submitReport(item.payload as ReportData);
          if (result.success) {
            await removeFromOutbox(item.localId);
            reportsSent += 1;
            continue;
          }
          await note(item, result.error);
          // No session yet for an account-bound report: stop and try later.
          if ((item.payload as ReportData).is_authenticated) break;
        } else {
          const post = item.payload as QueuedPost;
          const result = await createPost(post.body, [], { pinned: post.pinned });
          if (result?.ok) {
            await removeFromOutbox(item.localId);
            postsSent += 1;
            continue;
          }
          await note(item, result?.error);
          // Not signed in, or no longer a member: leave it and stop.
          break;
        }
      } catch (err) {
        // The connection dropped mid-flush. Stop; the next trigger resumes.
        await note(item, err instanceof Error ? err.message : String(err));
        break;
      }
    }
  } finally {
    flushing = false;
  }

  if (reportsSent > 0) {
    toast.success(
      reportsSent === 1
        ? "Your saved report has been submitted."
        : `${reportsSent} saved reports have been submitted.`,
    );
  }
  if (postsSent > 0) {
    toast.success(postsSent === 1 ? "Your post has been sent." : `${postsSent} posts have been sent.`);
  }
}

async function note(item: OutboxItem, error?: string) {
  item.attempts += 1;
  item.lastError = error;
  await updateOutboxItem(item);
}

/** The old name, still imported by the report form. */
export const flushOfflineQueue = flushOutbox;

/**
 * Mounted once at the app root. Flushes on load, when the network returns,
 * when the tab becomes visible again, and when the service worker's Background
 * Sync fires.
 */
export function OfflineSyncManager() {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void flushOutbox();
    };

    const t = setTimeout(run, 1200);

    const onOnline = () => run();
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    const onSwMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "WHRD_FLUSH_QUEUE") run();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);

  return null;
}
