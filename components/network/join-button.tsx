"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, UserPlus, X } from "lucide-react";
import { requestMembership } from "@/app/actions/membership";
import { Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

type State = "none" | "pending" | "approved" | "rejected";

/**
 * Ask to join an organisation. Open to anyone with an account, including
 * someone whose account started on the reporting side.
 */
export function JoinButton({
  organizationId,
  organizationName,
  state,
  signedIn,
}: {
  organizationId: string;
  organizationName: string;
  state: State;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<State>(state);

  if (local === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" /> You are a member
      </span>
    );
  }

  if (local === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="h-3.5 w-3.5" /> Awaiting approval
      </span>
    );
  }

  const submit = () => {
    if (!signedIn) {
      router.push(`/login?next=/organizations`);
      return;
    }
    start(async () => {
      const res = await requestMembership(organizationId, note || undefined);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setLocal("pending");
      setOpen(false);
      toast.success(`Request sent to ${organizationName}.`);
      router.refresh();
    });
  };

  return (
    <>
      <button
        onClick={() => (signedIn ? setOpen(true) : router.push("/login?next=/organizations"))}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-ink transition-colors hover:bg-purple-050 hover:text-purple-700"
      >
        <UserPlus className="h-3.5 w-3.5" />
        {local === "rejected" ? "Ask again" : "Ask to join"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ask to join ${organizationName}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-ink">Ask to join</h2>
                <p className="mt-0.5 text-sm text-muted">{organizationName}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted">
              An admin of this network will review your request. Telling them who you are
              and how you are connected makes it much easier to say yes.
            </p>

            <Textarea
              className="mt-3"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: I volunteer with the Kitui paralegal desk and was referred by Faith."
              aria-label="Message to the network admins"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={submit}
                disabled={pending}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send request
              </button>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-bold text-ink hover:bg-purple-050"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
