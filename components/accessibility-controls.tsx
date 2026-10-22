"use client";

import { useEffect, useState } from "react";
import { Type, Contrast, Underline, Sparkles, RotateCcw, Gauge } from "lucide-react";

export interface Prefs {
  scale: number; // 1, 1.1, 1.25, 1.4
  contrast: boolean;
  links: boolean;
  motion: boolean;
  /** Low data mode: no large remote photos, no blur or shadow effects. */
  lite: boolean;
}

export const A11Y_DEFAULT: Prefs = { scale: 1, contrast: false, links: false, motion: false, lite: false };
export const A11Y_KEY = "whrd-a11y";

export function applyA11y(p: Prefs) {
  const root = document.documentElement;
  root.style.setProperty("--a11y-scale", String(p.scale));
  root.classList.toggle("a11y-contrast", p.contrast);
  root.classList.toggle("a11y-links", p.links);
  root.classList.toggle("a11y-motion", p.motion);
  root.classList.toggle("a11y-lite", p.lite);
}

function Toggle({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Contrast; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-3 w-full rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors ${on ? "border-purple bg-purple-050 text-purple-700" : "border-line bg-surface text-ink hover:bg-purple-050"}`}
    >
      <Icon className="w-4 h-4 shrink-0" /> {label}
      <span className={`ml-auto text-xs font-bold ${on ? "text-purple-700" : "text-muted"}`}>{on ? "On" : "Off"}</span>
    </button>
  );
}

/**
 * The accessibility settings body (text size + toggles + reset). Reused by the
 * floating widget and by the profile page so the controls are always reachable,
 * including on mobile where the floating button is hidden.
 */
export function AccessibilityControls() {
  const [prefs, setPrefs] = useState<Prefs>(A11Y_DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(A11Y_KEY);
      if (saved) {
        const p = { ...A11Y_DEFAULT, ...JSON.parse(saved) } as Prefs;
        setPrefs(p);
        applyA11y(p);
      }
    } catch { /* ignore */ }
  }, []);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyA11y(next);
    try { localStorage.setItem(A11Y_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="rounded-xl border border-line p-3 mb-2.5">
        <p className="text-sm font-semibold text-ink flex items-center gap-2 mb-2"><Type className="w-4 h-4" /> Text size</p>
        <div className="flex gap-1.5">
          {[{ label: "A", v: 1 }, { label: "A+", v: 1.1 }, { label: "A++", v: 1.25 }, { label: "A+++", v: 1.4 }].map((s) => (
            <button key={s.v} onClick={() => update({ scale: s.v })}
              className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${prefs.scale === s.v ? "border-purple bg-purple text-white" : "border-line bg-surface text-ink hover:bg-purple-050"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <Toggle on={prefs.contrast} onClick={() => update({ contrast: !prefs.contrast })} icon={Contrast} label="Higher contrast" />
        <Toggle on={prefs.links} onClick={() => update({ links: !prefs.links })} icon={Underline} label="Underline links" />
        <Toggle on={prefs.motion} onClick={() => update({ motion: !prefs.motion })} icon={Sparkles} label="Reduce motion" />
        <Toggle on={prefs.lite} onClick={() => update({ lite: !prefs.lite })} icon={Gauge} label="Low data mode" />
      </div>

      <button onClick={() => update(A11Y_DEFAULT)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink hover:bg-purple-050">
        <RotateCcw className="w-4 h-4" /> Reset
      </button>
    </div>
  );
}
