"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in the background. Kept intentionally quiet:
 * no UI, no toasts. Update handling silently activates the new worker.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return; // avoid caching during dev

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // If an updated worker is waiting, activate it immediately.
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              reg.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      } catch {
        // Registration failures are non-fatal; the app works without the SW.
      }
    };

    register();
  }, []);

  return null;
}
