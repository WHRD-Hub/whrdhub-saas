"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { respondToReferral } from "@/app/actions/matching";
import { toast } from "@/components/ui/toast";

/**
 * The survivor's answer to an offer of support.
 *
 * Deliberately two plain buttons and no confirmation step. Someone reading
 * this may be in a hurry or in distress, and a modal asking "are you sure you
 * want help?" is the wrong thing to put in front of them. Declining is
 * reversible: the Hub finds another service.
 */
export function ReferralResponse({
  referralId,
  serviceName,
}: {
  referralId: string;
  serviceName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [decliningReason, setDecliningReason] = useState<string | null>(null);

  const respond = (decision: "accept" | "decline", reason?: string) => {
    start(async () => {
      const res = await respondToReferral(referralId, decision, reason);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        decision === "accept"
          ? `${serviceName} has been told you would like their help.`
          : "Thanks for letting us know. We will look for another service.",
      );
      setDecliningReason(null);
      router.refresh();
    });
  };

  if (decliningReason !== null) {
    return (
      <div className="mt-3 rounded-xl border border-line bg-paper p-3">
        <label htmlFor={`decline-${referralId}`} className="block text-xs font-semibold text-ink">
          Anything you want us to know? (optional)
        </label>
        <input
          id={`decline-${referralId}`}
          value={decliningReason}
          onChange={(e) => setDecliningReason(e.target.value)}
          placeholder="Too far, wrong kind of help, already sorted…"
          className="mt-1.5 h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-purple/40 focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => respond("decline", decliningReason || undefined)}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send
          </button>
          <button
            onClick={() => setDecliningReason(null)}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={() => respond("accept")}
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-purple px-4 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Yes, connect me
      </button>
      <button
        onClick={() => setDecliningReason("")}
        disabled={pending}
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-purple-050 disabled:opacity-50"
      >
        <X className="h-4 w-4" /> Not this one
      </button>
    </div>
  );
}
