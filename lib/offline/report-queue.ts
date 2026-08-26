"use client";

/**
 * Report-shaped view of the outbox, kept so the report form and the sync
 * manager read naturally. See lib/offline/outbox.ts for the store itself.
 */

import type { ReportData } from "@/app/actions/report-submit";
import {
  enqueue,
  getOutbox,
  removeFromOutbox,
  updateOutboxItem,
  requestBackgroundSync,
  type OutboxItem,
} from "@/lib/offline/outbox";

export type { OutboxItem as QueuedReport };
export { requestBackgroundSync };

export async function enqueueReport(payload: ReportData): Promise<OutboxItem> {
  return enqueue("report", payload);
}

export async function getQueuedReports(): Promise<OutboxItem[]> {
  return getOutbox("report");
}

export async function countQueuedReports(): Promise<number> {
  return (await getOutbox("report")).length;
}

export async function removeQueuedReport(localId: string): Promise<void> {
  return removeFromOutbox(localId);
}

export async function updateQueuedReport(record: OutboxItem): Promise<void> {
  return updateOutboxItem(record);
}
