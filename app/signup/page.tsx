"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { signUp, type AuthState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state?.checkEmail) {
    return (
      <AuthShell heading="Check your email" sub="One more step to get started">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-050 text-purple">
            <MailCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 text-sm text-muted">
            We sent you a confirmation link. Open it to finish setting up your account.
          </p>
          <Button href="/login" variant="outline" className="mt-5 w-full">
            Go to log in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Join the Hub"
      sub="One account works across the Hub and reporting platform"
      footer={
        <>
          Already a member?{" "}
          <Link href="/login" className="font-bold text-purple-700">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton next="/onboarding" label="Sign up with Google" />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Server action, for the same reasons as sign-in: the cookie and the
          redirect leave together, and the confirmation link is built from
          configured site URL rather than from anything the browser supplied. */}
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="fullName" required autoComplete="name" placeholder="Your name" />
        </div>
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
        <div>
          <Label htmlFor="password">Password</Label>
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
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
