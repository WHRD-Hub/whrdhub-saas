"use client";

import {
  createContext, useContext, useCallback, useSyncExternalStore, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  translations, LANGUAGE_META, SUPPORTED, type Language, type TranslationSchema,
} from "./translations";
import {
  subscribe, getSnapshot, getServerSnapshot, writeLanguage,
} from "./language-store";
import { updateLanguagePreference } from "@/app/actions/preferences";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationSchema;
  isRTL: boolean;
  /** Dual-language labels were retired; kept so callers need no changes. */
  isDualLang: boolean;
  secondaryLang: Language | null;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback(
    (lang: Language) => {
      writeLanguage(lang);
      // Re-render server components so their strings switch immediately.
      router.refresh();
      // Fire-and-forget: persists to the profile for signed-in users so other
      // devices pick the same language up. No-op when unauthenticated.
      updateLanguagePreference(lang).catch(() => {});
    },
    [router],
  );

  const t = translations[language] as unknown as TranslationSchema;
  const isRTL = LANGUAGE_META[language].rtl;

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, isRTL, isDualLang: false, secondaryLang: null }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

/** Convenience hook: just the translator. */
export function useT() {
  return useLanguage().t;
}

export { LANGUAGE_META, SUPPORTED, type Language };
