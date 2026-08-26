"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck } from "lucide-react";
import { banAccount, unbanAccount } from "@/app/actions/moderation";
import { toast } from "@/components/ui/toast";

/**
 * Banning is the Hub's escalation of a network's suspension.
 *
 * It stops the person acting anywhere on the platform. It does not delete
 * anything they wrote: a moderation record that erased the evidence would be
 * worse than useless, and the content is what any later review turns on.
 */
export function BanControls({
  userId,
  name,
  banned,
  reason,
}: {
  userId: string;
  name: string;
  banned: boolean;
  reason?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const lift = () => {
    start(async () => {
      const res = await unbanAccount(userId);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${name} can use the platform again.`);
        router.refresh();
      }
    });
  };

  const ban = () => {
    start(async () => {
      const res = await banAccount(userId, text);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name} is banned.`);
      setOpen(false);
      setText("");
      router.refresh();
    });
  };

  if (banned) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <button
          onClick={lift}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-bold text-ink/80 hover:bg-purple-050 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Lift ban
        </button>
        {reason && <p className="max-w-[16rem] text-right text-[11px] text-muted">{reason}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 bg-surface px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
      >
        <Ban className="h-3.5 w-3.5" /> Ban account
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3">
      <label htmlFor={`ban-${userId}`} className="block text-xs font-bold text-rose-900">
        Why is {name} being banned?
      </label>
      <p className="mt-0.5 text-[11px] text-rose-800">
        They will see this. Nothing they have written is deleted.
      </p>
      <input
        id={`ban-${userId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Continued harassment after a network suspension…"
        className="mt-2 h-9 w-full rounded-lg border border-rose-200 bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-rose-300"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={ban}
          disabled={pending || text.trim().length < 4}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Ban
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
