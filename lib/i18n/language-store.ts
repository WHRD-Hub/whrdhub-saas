"use client";

import { LANGUAGE_META, SUPPORTED, type Language } from "./translations";

/**
 * The chosen language as an external store.
 *
 * It was previously read from localStorage inside a mount effect, which meant
 * an extra render pass on every page load (and a brief flash of English).
 * Exposing it as a subscribable store lets components read it with
 * useSyncExternalStore: the server snapshot is "en", the client snapshot is the
 * real preference, and no setState-in-effect is needed.
 */

const LS_KEY = "whrd-language";
export const COOKIE_KEY = "whrd-lang";

const listeners = new Set<() => void>();
let cached: Language | null = null;

function detect(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem(LS_KEY) as Language | null;
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    /* private mode */
  }
  const browser = navigator.language?.toLowerCase() ?? "en";
  if (browser.startsWith("sw")) return "sw";
  if (browser.startsWith("fr")) return "fr";
  if (browser.startsWith("pt")) return "pt";
  if (browser.startsWith("de")) return "de";
  if (browser.startsWith("ar")) return "ar";
  return "en";
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) {
      cached = null;
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Cached so repeated snapshot reads are referentially stable. */
export function getSnapshot(): Language {
  if (cached === null) cached = detect();
  return cached;
}

export function getServerSnapshot(): Language {
  return "en";
}

export function writeLanguage(lang: Language) {
  cached = lang;
  try {
    localStorage.setItem(LS_KEY, lang);
  } catch {
    /* ignore */
  }
  // Read synchronously by getServerLanguage() during the router refresh that
  // follows, so server-rendered strings switch in the same pass.
  document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  const meta = LANGUAGE_META[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
  listeners.forEach((l) => l());
}
