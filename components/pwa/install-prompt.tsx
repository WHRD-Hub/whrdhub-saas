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
 * Offers to install the app to the home screen.
 *
 * Mounted at the app root, so it appears on any page a visitor opens. On
 * Chromium it rides the native `beforeinstallprompt` event, which only fires
 * once the browser considers the app installable; on iOS Safari, which has no
 * such event, it shows the manual "Add to Home Screen" steps instead.
 *
 * Installing matters more here than it does for most sites: the installed app
 * is what lets someone file a report with no signal.
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
    // The delay keeps this from landing on top of the language chooser.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos() && !isStandalone()) {
      iosTimer = setTimeout(() => setVisible(true), 4000);
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
      className="rise fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md rounded-2xl border border-purple/20 bg-surface p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-purple/10 text-purple flex items-center justify-center">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-ink">Install WHRD Hub</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            Add it to your home screen. It opens faster, looks like any other app on your
            phone, and lets you write a report or a post with no signal &mdash; they send
            themselves once you are back online.
          </p>

          {showIosHelp ? (
            <div className="mt-3 space-y-1.5 rounded-xl border border-line bg-paper p-3 text-xs text-muted">
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
