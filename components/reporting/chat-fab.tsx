"use client";

import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { ChatPanel } from "@/components/reporting/chat-panel";

/**
 * Floating launcher for the resource assistant. Rewritten as a plain slide-over
 * so the merged app does not need Radix's Sheet.
 */
export function ChatFab() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.chat.fabLabel}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.chat.title}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-2xl sm:max-w-md"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted transition-colors hover:bg-purple-050 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
            <ChatPanel />
          </div>
        </div>
      )}
    </>
  );
}
