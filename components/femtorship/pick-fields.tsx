"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Free-text answers to "Other" are stored in the same list as the ticked options, as "Other: <text>". */
export const OTHER_LABEL = "Other";
const PREFIX = "Other: ";

export function splitOther(values: string[], options: string[]): { picked: string[]; other: string; hasOther: boolean } {
  const known = values.filter((v) => options.includes(v));
  const o = values.find((v) => v === OTHER_LABEL || v.startsWith(PREFIX));
  return { picked: known, other: o?.startsWith(PREFIX) ? o.slice(PREFIX.length) : "", hasOther: !!o };
}

export function joinOther(picked: string[], hasOther: boolean, other: string): string[] {
  if (!hasOther) return picked;
  const text = other.trim();
  return [...picked, text ? `${PREFIX}${text}` : OTHER_LABEL];
}

/**
 * Pill picker with an "Other" option that opens a text field, and an optional
 * cap on how many can be chosen.
 */
export function PickWithOther({
  options,
  value,
  onChange,
  max,
  otherPlaceholder = "Please specify",
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  otherPlaceholder?: string;
}) {
  const { picked, other, hasOther } = splitOther(value, options);
  const count = picked.length + (hasOther ? 1 : 0);
  const atMax = max !== undefined && count >= max;

  const toggle = (o: string) => {
    if (picked.includes(o)) return onChange(joinOther(picked.filter((x) => x !== o), hasOther, other));
    if (atMax) return;
    onChange(joinOther([...picked, o], hasOther, other));
  };
  const toggleOther = () => {
    if (hasOther) return onChange(picked);
    if (atMax) return;
    onChange(joinOther(picked, true, ""));
  };

  const pill = (on: boolean, disabled: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
      on ? "bg-purple text-white border-purple" : "bg-surface border-line text-ink hover:bg-purple-050",
      disabled && "cursor-not-allowed opacity-45 hover:bg-surface",
    );

  return (
    <div className="space-y-2.5">
      {max !== undefined && (
        <p className="text-xs font-semibold text-purple-700">
          Pick a maximum of {max} <span className="font-normal text-muted">({count} of {max} chosen)</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = picked.includes(o);
          const disabled = !on && atMax;
          return (
            <button key={o} type="button" onClick={() => toggle(o)} disabled={disabled} aria-pressed={on} className={pill(on, disabled)}>
              {on && <Check className="h-3.5 w-3.5" />} {o}
            </button>
          );
        })}
        <button type="button" onClick={toggleOther} disabled={!hasOther && atMax} aria-pressed={hasOther} className={pill(hasOther, !hasOther && atMax)}>
          {hasOther && <Check className="h-3.5 w-3.5" />} {OTHER_LABEL}
        </button>
      </div>
      {hasOther && (
        <Input
          value={other}
          onChange={(e) => onChange(joinOther(picked, true, e.target.value))}
          placeholder={otherPlaceholder}
          aria-label="Other, please specify"
          maxLength={120}
        />
      )}
    </div>
  );
}
