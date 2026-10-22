"use client";

/**
 * Receiving what a phone shares with the app.
 *
 * When someone shares a link, a screenshot or a photo to WHRD Hub from another
 * app, the service worker catches it, keeps it here (IndexedDB, on the device)
 * and opens the report form. The form then reads it back and fills itself in.
 * The files never leave the phone until the person presses submit, and the copy
 * kept here is deleted as soon as the form has taken it.
 */

export interface SharedItem {
  title: string;
  text: string;
  url: string;
  files: { name: string; type: string; blob: Blob }[];
  at: number;
}

const DB = "whrd-share";
const STORE = "shared";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readShared(): Promise<SharedItem | null> {
  try {
    const db = await open();
    const item = await new Promise<SharedItem | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get("latest");
      req.onsuccess = () => resolve((req.result as SharedItem | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return item;
  } catch {
    return null;
  }
}

export async function clearShared(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("latest");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* nothing to clear */
  }
}

/** The first web address in a piece of text. */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;!?]+$/, "") : null;
}

/** The report form's platform name for a link, or null when it is not a platform we know. */
export function platformFromUrl(raw: string): string | null {
  let host = "";
  try { host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
  const table: [RegExp, string][] = [
    [/(^|\.)(x|twitter)\.com$|^t\.co$/, "Twitter / X"],
    [/(^|\.)instagram\.com$|^instagr\.am$/, "Instagram"],
    [/(^|\.)facebook\.com$|^fb\.(com|watch)$|^m\.facebook\.com$/, "Facebook"],
    [/(^|\.)tiktok\.com$/, "TikTok"],
    [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
    [/(^|\.)whatsapp\.com$|^wa\.me$/, "WhatsApp"],
    [/^t\.me$|(^|\.)telegram\.(org|me)$/, "Telegram"],
    [/(^|\.)linkedin\.com$/, "LinkedIn"],
    [/(^|\.)snapchat\.com$/, "Snapchat"],
  ];
  return table.find(([re]) => re.test(host))?.[1] ?? null;
}
