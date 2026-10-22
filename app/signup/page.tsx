"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, Loader2, MailCheck, Megaphone, Users } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/reporting/copy-button";
import { signUp, signUpAnonymous, type AuthState } from "@/app/actions/auth";

type Kind = "reporter" | "member" | "anonymous";

const KINDS: { value: Kind; title: string; body: string; icon: typeof Megaphone }[] = [
  { value: "reporter", title: "Just report", body: "An email account to file and follow your reports. Nothing else.", icon: Megaphone },
  { value: "member", title: "Join a chapter", body: "Be part of a county network: post, share stories and find a femtor.", icon: Users },
  { value: "anonymous", title: "Stay anonymous", body: "No email, no name. We give you a username to keep.", icon: EyeOff },
];

export default function SignupPage() {
  const [kind, setKind] = useState<Kind>("reporter");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUp, {});
  const [anonState, anonAction, anonPending] = useActionState<AuthState, FormData>(signUpAnonymous, {});

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

  // An anonymous account exists the moment this appears: show the username once, before moving on.
  if (anonState?.username) {
    return (
      <AuthShell heading="Keep these safe" sub="This is the only time we will show your username">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="eyebrow">Your username</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <code className="break-all font-mono text-lg font-bold text-ink">{anonState.username}</code>
              <CopyButton text={anonState.username} label="Copy" />
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Write your username and password down somewhere safe.</p>
            <p className="mt-1 text-xs">No email is linked to this account, so there is no way to reset it if you lose them.</p>
          </div>
          <Button href="/dashboard/reports" className="w-full">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Join the Hub"
      sub="Choose how you would like to take part. You can change this later."
      footer={
        <>
          Already a member?{" "}
          <Link href="/login" className="font-bold text-purple-700">
            Log in
          </Link>
        </>
      }
    >
      <div role="radiogroup" aria-label="How would you like to join?" className="grid gap-2.5">
        {KINDS.map(({ value, title, body, icon: Icon }) => {
          const on = kind === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setKind(value)}
              className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                on ? "border-purple/50 bg-purple-050" : "border-line bg-surface hover:bg-paper"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? "bg-purple text-white" : "bg-paper text-purple"}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{body}</span>
              </span>
            </button>
          );
        })}
      </div>

      {kind !== "anonymous" && (
        <>
          <div className="mt-5">
            <GoogleButton next={kind === "member" ? "/onboarding" : "/dashboard/reports"} label="Sign up with Google" />
          </div>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">or with email</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* Server action, for the same reasons as sign-in: the cookie and the
              redirect leave together, and the confirmation link is built from the
              configured site URL rather than from anything the browser supplied. */}
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="accountKind" value={kind} />
            <div>
              <Label htmlFor="name">
                Full name {kind === "reporter" && <span className="font-normal text-muted">(optional)</span>}
              </Label>
              <Input id="name" name="fullName" required={kind === "member"} autoComplete="name" placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="name@example.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
            </div>

            {state?.error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-purple text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : kind === "member" ? "Create account and continue" : "Create account"}
            </button>
          </form>
        </>
      )}

      {kind === "anonymous" && (
        <form action={anonAction} className="mt-5 space-y-4">
          <div className="rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-muted">
            We will create a username for you. Choose a password you will remember. We never ask for your name or email.
          </div>
          <div>
            <Label htmlFor="anon-password">Password</Label>
            <Input id="anon-password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          {anonState?.error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{anonState.error}</p>
          )}
          <button
            type="submit"
            disabled={anonPending}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-purple text-sm font-bold text-white transition-colors hover:bg-purple-600 disabled:opacity-60"
          >
            {anonPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create my anonymous account"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
