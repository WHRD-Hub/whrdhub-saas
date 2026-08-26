"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { submitReport } from "@/app/actions/report-submit";
import {
  getQueuedReports,
  removeQueuedReport,
  updateQueuedReport,
} from "@/lib/offline/report-queue";

// Dispatched whenever the queue size changes so any UI (badges, banners) can react.
export const QUEUE_CHANGED_EVENT = "whrd-queue-changed";

function announceQueueChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

let flushing = false;

/**
 * Attempts to submit every queued report. Safe to call repeatedly.
 * - Authenticated reports that fail because there is no session are left in the
 *   queue (they'll go through once the user logs in again).
 * - Other failures are retried on the next trigger.
 */
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  let submitted = 0;

  try {
    const queue = await getQueuedReports();
    for (const item of queue) {
      try {
        const result = await submitReport(item.payload);
        if (result.success) {
          await removeQueuedReport(item.localId);
          submitted += 1;
          announceQueueChange();
        } else {
          // No session yet for an authenticated report — keep it and stop.
          if (item.payload.is_authenticated) {
            item.attempts += 1;
            item.lastError = result.error;
            await updateQueuedReport(item);
            break;
          }
          item.attempts += 1;
          item.lastError = result.error;
          await updateQueuedReport(item);
        }
      } catch (err) {
        // Network dropped mid-flush; stop and retry later.
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        await updateQueuedReport(item);
        break;
      }
    }
  } finally {
    flushing = false;
  }

  if (submitted > 0) {
    toast.success(
      submitted === 1
        ? "Your saved report has been submitted."
        : `${submitted} saved reports have been submitted.`
    );
  }
}

/**
 * Mounted once at the app root. Triggers a flush on load, when the network
 * comes back, when the tab becomes visible, and when the service worker's
 * Background Sync fires.
 */
export function OfflineSyncManager() {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void flushOfflineQueue();
    };

    // Initial attempt shortly after load.
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
