"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { RISK_GROUPS, SUPPORT_TYPES } from "@/lib/reporting-options";
import { updateReportRisks } from "@/app/actions/report-update";

function Check3({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
        checked ? "border-purple/50 bg-purple-050 text-purple-700" : "border-line bg-surface text-ink hover:bg-paper"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border ${
          checked ? "border-purple bg-purple text-white" : "border-line bg-surface"
        }`}
        style={{ width: 18, height: 18 }}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="leading-snug">{children}</span>
    </label>
  );
}

/** The "Risks associated with" form, opened from a button on the report's own line. */
export function ReportRisksButton({
  reportId,
  label,
  initialRisks,
  initialSupport,
  initialOther,
}: {
  reportId: string;
  /** What the report is about, shown in the dialog title. */
  label: string;
  initialRisks: string[];
  initialSupport: string[];
  initialOther: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [risks, setRisks] = useState<string[]>(initialRisks);
  const [support, setSupport] = useState<string[]>(initialSupport);
  const [other, setOther] = useState(initialOther);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flip = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = () =>
    start(async () => {
      setError(null);
      const res = await updateReportRisks(reportId, { risks, support, supportOther: other });
      if ("error" in res) { setError(res.error); return; }
      toast.success("Saved. The response team can see this now.");
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-purple-700 transition-colors hover:border-purple/40 hover:bg-purple-050"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Risks</span>
        {initialRisks.length > 0 && (
          <span className="rounded-full bg-purple px-1.5 text-[10px] text-white">{initialRisks.length}</span>
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Risks associated with"
        subtitle={label}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {risks.length} risk{risks.length === 1 ? "" : "s"} · {support.length} support type{support.length === 1 ? "" : "s"} selected
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        <p className="mb-5 text-sm text-muted">
          Tick everything you are facing because of what happened. Only you and the response team can see this.
        </p>

        <div className="space-y-6">
          {RISK_GROUPS.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted">{g.title}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.risks.map((r) => (
                  <Check3 key={r.value} checked={risks.includes(r.value)} onChange={() => flip(risks, r.value, setRisks)}>
                    {r.label}
                  </Check3>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted">Support you need</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUPPORT_TYPES.map((s) => (
                <Check3 key={s.value} checked={support.includes(s.value)} onChange={() => flip(support, s.value, setSupport)}>
                  {s.label}
                </Check3>
              ))}
            </div>
            {support.includes("other") && (
              <Textarea
                rows={2}
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Tell us what support you need"
                aria-label="Describe the other support you need"
                className="mt-2"
              />
            )}
          </fieldset>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </Modal>
    </>
  );
}
