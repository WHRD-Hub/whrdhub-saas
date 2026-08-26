"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PauseCircle, PlayCircle } from "lucide-react";
import { suspendMember, unsuspendMember } from "@/app/actions/moderation";
import { toast } from "@/components/ui/toast";

/**
 * Pausing a member of your network.
 *
 * A reason is required, not optional: the person is told exactly what it says,
 * and so is the Hub, which is the only body that can take it further. A
 * suspension with no stated reason helps nobody and is hard to lift fairly.
 */
export function SuspendMember({
  membershipId,
  name,
  suspended,
}: {
  membershipId: string;
  name: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const lift = () => {
    start(async () => {
      const res = await unsuspendMember(membershipId);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${name} can take part again.`);
        router.refresh();
      }
    });
  };

  const suspend = () => {
    start(async () => {
      const res = await suspendMember(membershipId, reason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} is suspended. The Hub has been notified.`);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  if (suspended) {
    return (
      <button
        onClick={lift}
        disabled={pending}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink/80 hover:bg-purple-050 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        Lift suspension
      </button>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-surface px-2.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
      >
        <PauseCircle className="h-3.5 w-3.5" /> Suspend
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3">
      <label htmlFor={`suspend-${membershipId}`} className="block text-xs font-bold text-amber-900">
        Why is {name} being suspended?
      </label>
      <p className="mt-0.5 text-[11px] text-amber-800">
        They will see this, and so will the Hub.
      </p>
      <input
        id={`suspend-${membershipId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Repeated abuse in comments, impersonation, off-topic spam…"
        className="mt-2 h-9 w-full rounded-lg border border-amber-200 bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={suspend}
          disabled={pending || reason.trim().length < 4}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Suspend
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
