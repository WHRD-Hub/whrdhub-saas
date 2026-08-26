"use client";

/**
 * Minimal toast system.
 *
 * The reporting platform used `sonner`. Rather than add a dependency to the
 * merged app we keep the same call shape — `toast.success(...)`,
 * `toast.error(...)` — backed by a tiny event bus and a single <Toaster />
 * mounted in the root layout.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const EVENT = "whrd-toast";
let seq = 0;

function emit(kind: Kind, message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastItem>(EVENT, {
      detail: { id: ++seq, kind, message },
    }),
  );
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
  message: (message: string) => emit("info", message),
};

const TONES: Record<Kind, { cls: string; Icon: typeof Info }> = {
  success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  error: { cls: "border-rose-200 bg-rose-50 text-rose-900", Icon: AlertCircle },
  info: { cls: "border-line bg-surface text-ink", Icon: Info },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastItem>).detail;
      setItems((prev) => [...prev, detail]);
      window.setTimeout(
        () => setItems((prev) => prev.filter((t) => t.id !== detail.id)),
        5000,
      );
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (!items.length) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {items.map((t) => {
        const { cls, Icon } = TONES[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`rise flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${cls}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
