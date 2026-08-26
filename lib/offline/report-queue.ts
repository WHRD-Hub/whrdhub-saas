"use client";

/**
 * Offline report queue backed by IndexedDB.
 *
 * When a report can't reach the server (device offline, or the network request
 * fails), we persist the full payload here. A sync manager drains the queue and
 * calls the submit server action once connectivity — and, for authenticated
 * reports, a valid session — is available.
 *
 * IndexedDB is used (not localStorage) because it survives reloads, works from
 * the service worker's Background Sync context, and comfortably holds larger
 * structured payloads.
 */

import type { ReportData } from "@/app/actions/report-submit";

const DB_NAME = "whrd-offline";
const DB_VERSION = 1;
const STORE = "pending-reports";

export interface QueuedReport {
  /** Local-only id (uuid). Server report ids are separate. */
  localId: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  payload: ReportData;
}

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Add a report to the offline queue. Returns the created record. */
export async function enqueueReport(payload: ReportData): Promise<QueuedReport> {
  const record: QueuedReport = {
    localId: uuid(),
    createdAt: Date.now(),
    attempts: 0,
    payload,
  };
  if (!hasIDB()) throw new Error("Offline storage is not available on this device.");
  await tx("readwrite", (s) => s.put(record));
  return record;
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  if (!hasIDB()) return [];
  try {
    const all = await tx<QueuedReport[]>("readonly", (s) => s.getAll());
    return (all || []).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countQueuedReports(): Promise<number> {
  if (!hasIDB()) return 0;
  try {
    return await tx<number>("readonly", (s) => s.count());
  } catch {
    return 0;
  }
}

export async function removeQueuedReport(localId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx("readwrite", (s) => s.delete(localId));
}

export async function updateQueuedReport(record: QueuedReport): Promise<void> {
  if (!hasIDB()) return;
  await tx("readwrite", (s) => s.put(record));
}

/** Ask the service worker to retry submission when connectivity returns. */
export async function requestBackgroundSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    // SyncManager is not in all TS lib targets; guard at runtime.
    const sync = (reg as unknown as { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (sync) await sync.register("whrd-sync-reports");
  } catch {
    // Best-effort; the online-event listener is the reliable fallback.
  }
}
