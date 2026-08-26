"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Globe, X } from "lucide-react";
import { useLanguage, LANGUAGE_META, type Language } from "@/lib/i18n/context";
import { translations } from "@/lib/i18n/translations";

const CHOSEN_KEY = "whrd-lang-chosen";
const OTHER_LANGS: Language[] = ["fr", "pt", "de", "ar"];

/** Read the "already chose" flag without a mount effect. */
const noopSubscribe = () => () => {};
function readChosen(): string {
  try {
    return localStorage.getItem(CHOSEN_KEY) ?? "";
  } catch {
    // Private mode: treat as chosen so the prompt never blocks the form.
    return "1";
  }
}

/**
 * First-visit language chooser for the report flow. Rewritten without Radix so
 * the merged app keeps a single, dependency-light UI layer.
 */
export function LanguageOnboardingModal() {
  const { language, setLanguage } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  const t = translations[language].languageModal;

  // "1" during SSR so nothing renders until hydration has read the real value.
  const chosen = useSyncExternalStore(noopSubscribe, readChosen, () => "1");
  const open = !chosen && !dismissed;
  const setOpen = (v: boolean) => setDismissed(!v);

  const remember = () => {
    try {
      localStorage.setItem(CHOSEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  function choose(lang: Language) {
    setLanguage(lang);
    remember();
    setOpen(false);
  }

  function dismiss() {
    remember();
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/40 p-4"
      onClick={dismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lang-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="rise w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="float-right -mr-1 -mt-1 rounded-lg p-1 text-muted transition-colors hover:bg-purple-050 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-purple-050 text-purple">
          <Globe className="h-6 w-6" />
        </div>
        <h2 id="lang-modal-title" className="text-center text-lg font-black text-ink">
          {t.title}
        </h2>
        <p className="mt-1 text-center text-sm text-muted">{t.subtitle}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {(["en", "sw"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => choose(lang)}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-line py-5 text-sm font-bold text-ink transition-colors hover:border-purple hover:bg-purple-050"
            >
              <span className="text-2xl">{LANGUAGE_META[lang].flag}</span>
              {lang === "en" ? t.english : t.kiswahili}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <label
            htmlFor="lang-modal-other"
            className="mb-1.5 block text-xs font-semibold text-muted"
          >
            {t.otherLanguages}
          </label>
          <select
            id="lang-modal-other"
            defaultValue=""
            onChange={(e) => e.target.value && choose(e.target.value as Language)}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30"
          >
            <option value="">—</option>
            {OTHER_LANGS.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_META[lang].flag} {LANGUAGE_META[lang].nativeLabel}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
