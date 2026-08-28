"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Input, Label } from "@/components/ui/field";
import { signIn, type AuthState } from "@/app/actions/auth";
import { safeNext } from "@/lib/safe-next";

function LoginForm() {
  const params = useSearchParams();
  // Sanitised here as well as in the action. The action is the boundary that
  // actually matters; this stops a hostile `next` from reaching the markup.
  const next = safeNext(params.get("next"));

  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, {
    error: params.get("error") ? "Sign in failed. Please try again." : undefined,
  });

  return (
    <AuthShell
      heading="Welcome back"
      sub="Sign in to your Hub account"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-bold text-purple-700">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* A server action, not an onSubmit handler. The session cookie and the
          redirect leave in the same response, so there is no moment when the
          browser has moved on and the server does not yet know who you are --
          which is what made signing in take two attempts. It also means the
          form still works if JavaScript does not. */}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />

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
            autoComplete="current-password"
            placeholder="Your password"
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
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        Need to report abuse? You can do that{" "}
        <Link href="/report" className="font-semibold text-purple-700">
          without an account
        </Link>
        .
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
