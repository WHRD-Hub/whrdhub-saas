"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLanguage, LANGUAGE_META, SUPPORTED, type Language } from "@/lib/i18n/context";

interface LangSwitcherProps {
  /** compact: icon + code only. full: native label + flag. Default: compact */
  variant?: "compact" | "full";
  className?: string;
}

export function LangSwitcher({ variant = "compact", className = "" }: LangSwitcherProps) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const current = LANGUAGE_META[language];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select language, current: ${current.nativeLabel}`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-paper transition-colors text-sm font-medium text-ink select-none"
      >
        <Globe className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
        {variant === "full" ? (
          <span aria-hidden="true">{current.flag} {current.nativeLabel}</span>
        ) : (
          <span aria-hidden="true" className="uppercase">{language}</span>
        )}
        <ChevronDown className={`w-3 h-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1.5 z-[200] min-w-[180px] bg-white border border-line rounded-xl shadow-lg overflow-hidden"
        >
          {SUPPORTED.map((lang: Language) => {
            const meta = LANGUAGE_META[lang];
            const isSelected = lang === language;
            return (
              <button
                key={lang}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => { setLanguage(lang); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors
                  ${isSelected ? "bg-purple/5 text-purple font-semibold" : "text-ink hover:bg-paper"}`}
              >
                <span className="text-base leading-none">{meta.flag}</span>
                <span className="flex-1">{meta.nativeLabel}</span>
                <span className="text-xs text-muted">{meta.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
