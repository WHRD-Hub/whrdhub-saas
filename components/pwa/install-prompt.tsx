"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "whrd-install-dismissed";
// Re-surface the prompt this many days after a dismissal.
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Suggests installing the app to the home screen. On Chromium browsers it uses
 * the native `beforeinstallprompt` flow; on iOS Safari (no such event) it shows
 * the manual "Add to Home Screen" instructions.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // stop the mini-infobar; we drive the UX ourselves
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt — offer manual instructions instead.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos() && !isStandalone()) {
      iosTimer = setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
      return;
    }
    // No native prompt available (iOS) — reveal manual steps.
    setShowIosHelp(true);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Install WHRD Hub"
      className="rounded-2xl border border-purple/20 bg-purple/5 p-4 sm:p-5 shadow-sm"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-purple/10 text-purple flex items-center justify-center">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-ink">Install WHRD Hub</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Add the app to your home screen for faster, more private access &mdash; and
            to report even when you&apos;re offline.
          </p>

          {showIosHelp ? (
            <div className="mt-3 rounded-xl bg-white border border-line p-3 text-xs text-muted space-y-1.5">
              <p className="font-semibold text-ink">On iPhone / iPad:</p>
              <p className="flex items-center gap-1.5">
                1. Tap the Share icon <Share className="w-3.5 h-3.5 inline" /> in Safari.
              </p>
              <p className="flex items-center gap-1.5">
                2. Choose <span className="font-medium text-ink">Add to Home Screen</span>
                <Plus className="w-3.5 h-3.5 inline" />.
              </p>
              <p>3. Tap <span className="font-medium text-ink">Add</span>.</p>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={install} size="sm" className="gap-1.5 h-9 rounded-lg text-xs font-bold">
                <Download className="w-3.5 h-3.5" /> Install app
              </Button>
              <Button
                onClick={dismiss}
                size="sm"
                variant="ghost"
                className="h-9 rounded-lg text-xs text-muted"
              >
                Not now
              </Button>
            </div>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="Dismiss install suggestion"
          className="shrink-0 text-muted hover:text-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
