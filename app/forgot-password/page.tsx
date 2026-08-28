"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, type AuthState } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  // The same confirmation is shown whether or not that address has an account.
  // Anything else would let anyone test which addresses are registered here.
  if (state?.checkEmail) {
    return (
      <AuthShell heading="Check your email" sub="If we have an account, a link is on its way">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-050 text-purple">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm text-muted">
            If that address has an account with the Hub, we have sent it a link for setting a
            new password. The link works once and expires after an hour.
          </p>
          <p className="mt-3 text-sm text-muted">
            Nothing arrived? Check your spam folder, and make sure you used the address you
            signed up with.
          </p>
          <Button href="/login" variant="outline" className="mt-5 w-full">
            Back to log in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Forgotten your password?"
      sub="We will email you a link to set a new one"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-purple-700">
            Log in
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-purple text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send the link"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        Locked out and need to report something urgently? You can do that{" "}
        <Link href="/report" className="font-semibold text-purple-700">
          without an account
        </Link>
        .
      </p>
    </AuthShell>
  );
}
