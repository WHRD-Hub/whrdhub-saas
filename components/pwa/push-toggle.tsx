"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";

const noop = () => () => {};
const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Turn urgent-case alerts on for this device. The browser asks permission,
 * subscribes to push, and the subscription is saved against the signed-in
 * account. The notification itself carries no report content.
 */
export function PushToggle({ publicKey }: { publicKey: string | undefined }) {
  const ok = useSyncExternalStore(noop, supported, () => false);
  const [state, setState] = useState<"idle" | "busy" | "on" | "denied" | "error">("idle");

  // Learn whether this device is already subscribed.
  useEffect(() => {
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState("on");
        else if (Notification.permission === "denied") setState("denied");
      })
      .catch(() => undefined);
  }, [ok]);

  if (!publicKey) return null;
  if (!ok) return null;

  const enable = async () => {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("error");
    }
  };

  if (state === "on") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><BellRing className="h-4 w-4" /> Urgent-case alerts are on for this device.</p>
        <button type="button" onClick={disable} className="text-xs font-semibold text-emerald-800 underline">Turn off</button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-amber-900">
        {state === "denied" ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        {state === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser settings to get urgent-case alerts."
          : state === "error"
            ? "Could not turn alerts on just now. Please try again."
            : "Get an alert on this device the moment an urgent report comes in."}
      </p>
      {state !== "denied" && (
        <button type="button" onClick={enable} disabled={state === "busy"} className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-600 px-3.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60">
          {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Turn on alerts
        </button>
      )}
    </div>
  );
}
