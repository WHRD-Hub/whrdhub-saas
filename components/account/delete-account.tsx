"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { deleteMyAccount } from "@/app/actions/account";
import { Input, Label, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const CONFIRM = "DELETE";

/**
 * Account deletion, with the consequences stated plainly rather than buried.
 * A typed confirmation, because this is not a button anyone should hit twice.
 */
export function DeleteAccount({ email }: { email?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await deleteMyAccount(reason || undefined);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.push("/?deleted=1");
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-rose-600">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-ink">Delete your account</h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink/70">
            Your profile and everything you have posted leaves the Hub straight away, and
            you are signed out. Two things to know before you do it:
          </p>
          <ul className="mt-2 max-w-prose list-disc space-y-1 pl-5 text-sm text-ink/70">
            <li>
              The Hub keeps a record of deleted accounts and their content, so it can
              answer safeguarding questions later. It is not visible to other members.
            </li>
            <li>
              Any report you have filed stays with the response team. A case someone is
              working on is not withdrawn by closing an account - contact the Hub if you
              want a report removed too.
            </li>
          </ul>
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex h-11 items-center rounded-xl border border-rose-300 bg-surface px-5 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-5 space-y-4 rounded-xl border border-rose-200 bg-surface p-4">
          <div>
            <Label htmlFor="del-reason">Anything you want to tell us? (optional)</Label>
            <Textarea
              id="del-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="This helps the Hub understand why people leave."
            />
          </div>
          <div>
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-bold">{CONFIRM}</span> to confirm
              {email ? <span className="font-normal text-muted"> ({email})</span> : null}
            </Label>
            <Input
              id="del-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={submit}
              disabled={pending || typed !== CONFIRM}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-40"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Permanently delete
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-purple-050"
            >
              Keep my account
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
