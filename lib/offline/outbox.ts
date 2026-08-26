"use client";

/**
 * The outbox: things written on this device that have not reached the server.
 *
 * Backed by IndexedDB rather than localStorage because it survives reloads,
 * is reachable from the service worker's Background Sync context, and holds
 * structured payloads comfortably.
 *
 * It carries two kinds of item:
 *
 *   report  a report filed with no connection. The whole point of the offline
 *           story: someone documenting an incident in a place with no signal
 *           must not lose what they wrote.
 *   post    a feed post composed offline. Behaves the way a chat app does —
 *           it appears in your feed immediately marked "Sending", and goes out
 *           by itself when the connection returns.
 *
 * Media is deliberately not queued. Uploading an attachment needs the network,
 * so an offline post is text; the composer says so rather than silently
 * dropping a photo.
 */

import type { ReportData } from "@/app/actions/report-submit";

const DB_NAME = "whrd-offline";
const DB_VERSION = 2;
const REPORTS_STORE = "pending-reports";
const OUTBOX_STORE = "outbox";

export type OutboxKind = "report" | "post";

export interface QueuedPost {
  body: string;
  /** Hub admins can pin; carried so an offline Hub post behaves the same. */
  pinned?: boolean;
}

export interface OutboxItem {
  /** Local-only id. Server ids are separate and assigned on submission. */
  localId: string;
  kind: OutboxKind;
  createdAt: number;
  attempts: number;
  lastError?: string;
  payload: ReportData | QueuedPost;
}

/** Kept for the report-specific call sites that predate the outbox. */
export interface QueuedReport extends OutboxItem {
  kind: "report";
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
      if (!db.objectStoreNames.contains(REPORTS_STORE)) {
        db.createObjectStore(REPORTS_STORE, { keyPath: "localId" });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "localId" });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reports queued by an earlier version live in their own store. Move them into
 * the outbox the first time we look, so nothing written before an update is
 * stranded.
 */
async function migrateLegacyReports(): Promise<void> {
  if (!hasIDB()) return;
  try {
    const legacy = await tx<OutboxItem[]>(REPORTS_STORE, "readonly", (s) => s.getAll());
    if (!legacy?.length) return;
    for (const item of legacy) {
      await tx(OUTBOX_STORE, "readwrite", (s) =>
        s.put({ ...item, kind: "report" as const }),
      );
      await tx(REPORTS_STORE, "readwrite", (s) => s.delete(item.localId));
    }
  } catch {
    /* a failed migration must never block the app */
  }
}

export async function enqueue(
  kind: OutboxKind,
  payload: ReportData | QueuedPost,
): Promise<OutboxItem> {
  if (!hasIDB()) throw new Error("Offline storage is not available on this device.");
  const record: OutboxItem = { localId: uuid(), kind, createdAt: Date.now(), attempts: 0, payload };
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(record));
  announce();
  return record;
}

export async function getOutbox(kind?: OutboxKind): Promise<OutboxItem[]> {
  if (!hasIDB()) return [];
  try {
    await migrateLegacyReports();
    const all = await tx<OutboxItem[]>(OUTBOX_STORE, "readonly", (s) => s.getAll());
    return (all || [])
      .filter((i) => !kind || i.kind === kind)
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function countOutbox(kind?: OutboxKind): Promise<number> {
  return (await getOutbox(kind)).length;
}

export async function removeFromOutbox(localId: string): Promise<void> {
  if (!hasIDB()) return;
  await tx(OUTBOX_STORE, "readwrite", (s) => s.delete(localId));
  announce();
}

export async function updateOutboxItem(record: OutboxItem): Promise<void> {
  if (!hasIDB()) return;
  await tx(OUTBOX_STORE, "readwrite", (s) => s.put(record));
  announce();
}

/** Fired whenever the outbox changes, so badges and pending cards can react. */
export const OUTBOX_CHANGED_EVENT = "whrd-outbox-changed";

export function announce() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
  }
}

/** Ask the service worker to retry when connectivity returns. */
export async function requestBackgroundSync(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as unknown as { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (sync) await sync.register("whrd-sync-outbox");
  } catch {
    // Best effort. The online event listener is the reliable fallback.
  }
}
