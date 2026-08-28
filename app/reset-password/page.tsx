"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input, Label } from "@/components/ui/field";
import { updatePassword, type AuthState } from "@/app/actions/auth";

/**
 * Where a recovery link lands.
 *
 * Reaching this page means /auth/confirm has already exchanged the token for a
 * session, so there is nothing secret in the URL by the time anyone sees it —
 * which matters, because URLs end up in browser history, in screenshots and in
 * whatever app the link was opened from.
 *
 * Whether that session actually exists is decided in the action, on the
 * server. A page that decided it in the browser would be telling the visitor
 * what to think about their own credentials.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <AuthShell
      heading="Set a new password"
      sub="Choose something you have not used elsewhere"
      footer={
        <>
          Changed your mind?{" "}
          <Link href="/login" className="font-bold text-purple-700">
            Back to log in
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Type it again"
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {state.error}{" "}
            {state.error.includes("expired") && (
              <Link href="/forgot-password" className="font-bold underline">
                Request a new link
              </Link>
            )}
          </p>
        )}

        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-purple" />
          <p className="text-xs leading-relaxed text-muted">
            Changing your password signs out every other device. If somebody else had access
            to this account, they will lose it.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-purple text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}
