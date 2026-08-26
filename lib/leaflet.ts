"use client";

/**
 * Runtime Leaflet loader.
 *
 * The map view used to `import("leaflet")`, which needs the npm package in the
 * bundle. The merged app loads the same version from the CDN instead — the
 * stylesheet was already being pulled from there — so no new dependency is
 * required. If `leaflet` is later added to package.json, swap this for a plain
 * dynamic import; the shape returned here is the same module object.
 */

const VERSION = "1.9.4";
const JS_URL = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.js`;
const CSS_URL = `https://unpkg.com/leaflet@${VERSION}/dist/leaflet.css`;

// Leaflet ships no types here, so the surface we use is described loosely.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type LeafletModule = any;

let pending: Promise<LeafletModule> | null = null;

export function loadLeaflet(): Promise<LeafletModule> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Leaflet can only load in the browser"));
  }
  const existing = (window as any).L;
  if (existing) return Promise.resolve(existing);
  if (pending) return pending;

  pending = new Promise<LeafletModule>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS_URL;
      document.head.appendChild(link);
    }

    const done = () => {
      const L = (window as any).L;
      if (L) resolve(L);
      else reject(new Error("Leaflet loaded but window.L is missing"));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${JS_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", done, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load the map library")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = JS_URL;
    script.async = true;
    script.crossOrigin = "";
    script.onload = done;
    script.onerror = () => {
      pending = null;
      reject(new Error("Could not load the map library"));
    };
    document.head.appendChild(script);
  });

  return pending;
}
