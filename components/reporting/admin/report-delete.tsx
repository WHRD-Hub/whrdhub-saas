"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { adminDeleteReport } from "@/app/actions/lifecycle";
import { toast } from "@/components/ui/toast";

/**
 * Taking a report down. Admin-only, and always with a reason: the reporter
 * loses sight of the case, so the record of why has to survive.
 */
export function ReportDelete({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await adminDeleteReport(reportId, reason || undefined);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Report deleted. You can restore it from Deleted reports.");
      router.push("/hub/reporting/reports");
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-surface px-3 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete report
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3">
      <label htmlFor="del-report-reason" className="block text-xs font-bold text-rose-900">
        Why is this being deleted?
      </label>
      <input
        id="del-report-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Duplicate, test submission, reporter asked for removal…"
        className="mt-1.5 h-9 w-full rounded-lg border border-rose-200 bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
        </button>
        <button
          onClick={() => setOpen(false)}
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
