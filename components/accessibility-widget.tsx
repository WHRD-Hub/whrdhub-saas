"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Accessibility, X } from "lucide-react";
import { AccessibilityControls } from "@/components/accessibility-controls";

/** Pages that already carry the controls in the account menu, so no floating button is needed. */
const IN_CONSOLE = ["/hub", "/dashboard", "/mentorship", "/profile", "/onboarding"];

/**
 * A small, quiet accessibility button for the public pages (desktop only; on
 * mobile the same controls live in the profile). Inside the signed-in console
 * it does not appear at all: the controls are in the account menu there.
 */
export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (IN_CONSOLE.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Accessibility options"
        aria-expanded={open}
        className="fixed bottom-5 left-5 z-50 hidden h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-muted opacity-70 shadow-sm backdrop-blur transition hover:opacity-100 hover:text-purple focus:outline-none focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-purple/30 md:flex"
      >
        <Accessibility className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="fixed bottom-18 left-5 z-50 hidden w-[19rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-line bg-surface p-4 shadow-premium md:block">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold text-ink"><Accessibility className="h-4 w-4 text-purple" /> Accessibility</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink"><X className="h-5 w-5" /></button>
          </div>
          <AccessibilityControls />
        </div>
      )}
    </>
  );
}
