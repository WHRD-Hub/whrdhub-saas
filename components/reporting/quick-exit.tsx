"use client";

import { useEffect, useRef } from "react";

const ESCAPE_WINDOW_MS = 800;
const SAFE_URL = "https://www.google.com";

/**
 * Safety escape hatch for the report flow.
 *
 * The report page has always told people they can press Esc twice to leave
 * immediately, but nothing listened for it. This implements the promise:
 * two Esc presses inside a short window replace the current history entry
 * with a neutral page, so the back button does not return to the report form.
 */
export function QuickExit() {
  const lastPress = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - lastPress.current < ESCAPE_WINDOW_MS) {
        lastPress.current = 0;
        // Replace, don't push: the report page should not sit in history.
        window.location.replace(SAFE_URL);
        return;
      }
      lastPress.current = now;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

/** The visible affordance, so keyboard-free users can leave too. */
export function QuickExitButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.replace(SAFE_URL)}
      className={className}
    >
      click here
    </button>
  );
}
