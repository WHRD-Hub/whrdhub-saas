"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Phone, Plus, Printer, ShieldCheck, Trash2, Lock } from "lucide-react";
import { buildSafetyPlan } from "@/lib/abuse-profiles";
import { incidentLabel } from "@/lib/reporting-options";

interface Saved { done: string[]; mine: { id: string; text: string }[]; trusted: { id: string; name: string; phone: string }[] }

const EMPTY: Saved = { done: [], mine: [], trusted: [] };
const noop = () => () => {};

function load(key: string): Saved {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Saved>;
    return { done: p.done ?? [], mine: p.mine ?? [], trusted: p.trusted ?? [] };
  } catch {
    return EMPTY;
  }
}

/**
 * A personal safety plan shaped by what happened (and the risks someone says
 * they face). Ticks, her own steps and her trusted contacts live only in this
 * browser: nothing about the plan is sent to the server, so there is nothing for
 * anyone else to find.
 */
export function SafetyPlan({
  planKey,
  incidentTypes,
  risks = [],
  compact = false,
}: {
  /** Distinguishes one report's plan from another's on the same device. */
  planKey: string;
  incidentTypes: string[];
  risks?: string[];
  compact?: boolean;
}) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const plan = useMemo(() => buildSafetyPlan(incidentTypes, risks), [incidentTypes, risks]);
  // Rendered only in the browser, so the saved ticks can be read straight into state.
  if (!mounted) return <div className="card-premium h-40 animate-pulse" aria-hidden="true" />;
  return <PlanBody key={planKey} storageKey={`whrd-safety-plan:${planKey}`} incidentTypes={incidentTypes} plan={plan} compact={compact} />;
}

function PlanBody({
  storageKey, incidentTypes, plan, compact,
}: {
  storageKey: string;
  incidentTypes: string[];
  plan: ReturnType<typeof buildSafetyPlan>;
  compact: boolean;
}) {
  const [saved, setSaved] = useState<Saved>(() => load(storageKey));
  const [mineDraft, setMineDraft] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch { /* private mode: the plan still works for this visit */ }
  }, [storageKey, saved]);

  const total = plan.sections.reduce((n, s) => n + s.steps.length, 0) + saved.mine.length;
  const doneCount = plan.sections.reduce((n, s) => n + s.steps.filter((x) => saved.done.includes(x.id)).length, 0)
    + saved.mine.filter((m) => saved.done.includes(m.id)).length;

  const flip = (id: string) =>
    setSaved((p) => ({ ...p, done: p.done.includes(id) ? p.done.filter((x) => x !== id) : [...p.done, id] }));

  const addMine = () => {
    if (!mineDraft.trim()) return;
    setSaved((p) => ({ ...p, mine: [...p.mine, { id: `mine:${crypto.randomUUID()}`, text: mineDraft.trim().slice(0, 200) }] }));
    setMineDraft("");
  };
  const addTrusted = () => {
    if (!name.trim() || !phone.trim()) return;
    setSaved((p) => ({ ...p, trusted: [...p.trusted, { id: crypto.randomUUID(), name: name.trim().slice(0, 60), phone: phone.trim().slice(0, 30) }] }));
    setName(""); setPhone("");
  };

  return (
    <section className="card-premium p-5 sm:p-7 print:border-0 print:shadow-none" aria-labelledby="safety-plan-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Your safety plan</p>
          <h2 id="safety-plan-title" className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {plan.headline}
          </h2>
          {incidentTypes.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">Shaped by: {incidentTypes.map(incidentLabel).join(", ")}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-ink hover:bg-paper print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
      </div>

      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs text-muted">
        <Lock className="h-3.5 w-3.5 shrink-0 text-purple" />
        Your ticks, notes and contacts stay on this device only. They are never sent to us.
      </p>

      {plan.critical && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          This is being treated as an emergency. If you are in danger right now, call 999 first.
        </p>
      )}

      {total > 0 && (
        <div className="mt-4" aria-label={`${doneCount} of ${total} steps done`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-purple transition-all duration-500" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted">{doneCount} of {total} steps done</p>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {plan.sections.map((s) => (
          <div key={s.title}>
            <h3 className="eyebrow mb-2">{s.title}</h3>
            <ul className="space-y-1.5">
              {s.steps.slice(0, compact ? 3 : undefined).map((x) => (
                <li key={x.id}><Step id={x.id} text={x.text} done={saved.done.includes(x.id)} onFlip={flip} /></li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="eyebrow mb-2">Your own steps</h3>
          <ul className="space-y-1.5">
            {saved.mine.map((m) => (
              <li key={m.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><Step id={m.id} text={m.text} done={saved.done.includes(m.id)} onFlip={flip} /></div>
                <button type="button" aria-label="Remove step" onClick={() => setSaved((p) => ({ ...p, mine: p.mine.filter((x) => x.id !== m.id) }))} className="mt-2 text-muted hover:text-rose-600 print:hidden">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2 print:hidden">
            <input value={mineDraft} onChange={(e) => setMineDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMine()}
              placeholder="Add a step that fits your life" aria-label="Add your own step"
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30" />
            <button type="button" onClick={addMine} className="inline-flex h-10 items-center gap-1 rounded-xl bg-purple-050 px-3.5 text-sm font-bold text-purple-700 hover:bg-purple/10">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        <div>
          <h3 className="eyebrow mb-2">People you trust</h3>
          <ul className="space-y-1.5">
            {saved.trusted.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{t.name}</span>
                <span className="flex items-center gap-3">
                  <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1 text-sm font-semibold text-purple hover:underline"><Phone className="h-3.5 w-3.5" />{t.phone}</a>
                  <button type="button" aria-label={`Remove ${t.name}`} onClick={() => setSaved((p) => ({ ...p, trusted: p.trusted.filter((x) => x.id !== t.id) }))} className="text-muted hover:text-rose-600 print:hidden">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto] print:hidden">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name"
              className="h-10 rounded-xl border border-line bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" aria-label="Phone number" inputMode="tel"
              className="h-10 rounded-xl border border-line bg-surface px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple/30" />
            <button type="button" onClick={addTrusted} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-purple-050 px-3.5 text-sm font-bold text-purple-700 hover:bg-purple/10">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        <div>
          <h3 className="eyebrow mb-2">Who to call</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.contacts.map((c) => (
              <li key={c.name} className="rounded-xl border border-line bg-paper/60 px-3.5 py-3">
                <p className="text-sm font-bold text-ink">{c.name}</p>
                {c.number ? (
                  <a href={`tel:${c.number}`} className="mt-0.5 inline-flex items-center gap-1.5 text-lg font-black text-purple hover:underline">
                    <Phone className="h-4 w-4" />{c.number}
                  </a>
                ) : null}
                <p className="mt-0.5 text-xs text-muted">{c.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Step({ id, text, done, onFlip }: { id: string; text: string; done: boolean; onFlip: (id: string) => void }) {
  return (
    <div>
      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm leading-snug transition-colors ${done ? "border-emerald-200 bg-emerald-50/60 text-ink/60" : "border-line bg-surface text-ink hover:bg-paper"}`}>
        <input type="checkbox" checked={done} onChange={() => onFlip(id)} className="sr-only" />
        <span aria-hidden="true" className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-surface"}`}>
          {done && <Check className="h-3 w-3" />}
        </span>
        <span className={done ? "line-through decoration-ink/30" : ""}>{text}</span>
      </label>
    </div>
  );
}
