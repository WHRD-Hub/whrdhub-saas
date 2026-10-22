"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  /** Shown when nothing is chosen, so it doubles as the label: "County", "Urgency". */
  label: string;
  options: { value: string; label: string }[];
}

export interface Preset {
  id: string;
  label: string;
  /** The filters this view sets. Choosing it clears every other filter. */
  params: Record<string, string>;
  count?: number;
}

/**
 * One line of controls instead of a form: a search box and the filters as quiet
 * pills that show what is chosen and apply the moment they change. Controlled,
 * so it works for client-side lists as well as URL-driven ones.
 */
export function FilterBar({
  filters, values, onChange, onClear, search, busy, trailing,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  busy?: boolean;
  trailing?: React.ReactNode;
}) {
  const active = filters.filter((f) => values[f.key]).length + (search?.value ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-[0_1px_2px_rgba(28,21,34,0.04)]">
      {search && (
        <div className="relative min-w-[13rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
            className="h-9 w-full rounded-full bg-paper pl-9 pr-9 text-[13px] text-ink placeholder:text-muted focus:bg-surface focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
          {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
        </div>
      )}

      {filters.map((f) => {
        const v = values[f.key] ?? "";
        return (
          <div key={f.key} className="relative">
            <select
              aria-label={f.label}
              value={v}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={cn(
                "h-9 max-w-[11rem] appearance-none truncate rounded-full border pl-3.5 pr-8 text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-purple/30",
                v ? "border-purple/40 bg-purple-050 font-semibold text-purple-700" : "border-line bg-surface font-medium text-muted hover:text-ink",
              )}
            >
              <option value="">{f.label}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className={cn("pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2", v ? "text-purple-700" : "text-muted")} />
          </div>
        );
      })}

      {active > 0 && (
        <button type="button" onClick={onClear} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-muted hover:bg-paper hover:text-ink">
          <X className="h-3.5 w-3.5" /> Clear{active > 1 ? ` (${active})` : ""}
        </button>
      )}
      {trailing}
    </div>
  );
}

/** Quick views as a segmented control, each with an optional count. */
export function Segmented<T extends string>({
  items, value, onSelect, label,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T | null;
  onSelect: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-paper p-1">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onSelect(it.id)}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
            value === it.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {it.label}
          {it.count ? <span className="ml-1.5 text-[11px] font-bold text-muted">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The same bar driven by the address bar, for server-rendered lists: filters
 * apply as soon as they change, search waits for a pause in typing, and the
 * page number resets so a narrower list never opens on an empty page 4.
 */
export function UrlFilterBar({
  filters, presets, searchKey = "q", searchPlaceholder,
}: {
  filters: FilterDef[];
  presets?: Preset[];
  searchKey?: string;
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(sp.get(searchKey) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(sp.toString());
    mutate(p);
    p.delete("page");
    const qs = p.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const keys = [...filters.map((f) => f.key), searchKey];
  const values = Object.fromEntries(filters.map((f) => [f.key, sp.get(f.key) ?? ""]));

  const onSearch = (v: string) => {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go((p) => (v.trim() ? p.set(searchKey, v.trim()) : p.delete(searchKey))), 350);
  };

  const activePreset = presets?.find(
    (pr) =>
      Object.entries(pr.params).every(([k, v]) => sp.get(k) === v) &&
      keys.filter((k) => !(k in pr.params)).every((k) => !sp.get(k)),
  )?.id ?? null;

  return (
    <div className="space-y-3">
      {presets && (
        <Segmented
          label="Quick views"
          items={presets.map((p) => ({ id: p.id, label: p.label, count: p.count }))}
          value={activePreset}
          onSelect={(id) => {
            const pr = presets.find((p) => p.id === id)!;
            setQ("");
            go((p) => { keys.forEach((k) => p.delete(k)); Object.entries(pr.params).forEach(([k, v]) => p.set(k, v)); });
          }}
        />
      )}
      <FilterBar
        filters={filters}
        values={values}
        busy={pending}
        search={searchPlaceholder ? { value: q, onChange: onSearch, placeholder: searchPlaceholder } : undefined}
        onChange={(key, value) => go((p) => (value ? p.set(key, value) : p.delete(key)))}
        onClear={() => { setQ(""); go((p) => keys.forEach((k) => p.delete(k))); }}
      />
    </div>
  );
}
