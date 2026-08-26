"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the device currently has a connection.
 *
 * navigator.onLine is an external store, so it is read with
 * useSyncExternalStore rather than mirrored into state by an effect: no extra
 * render on mount, and no window where the UI and the browser disagree. The
 * server snapshot is `true`, so nothing renders an offline state during SSR
 * and then flips.
 */
function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
