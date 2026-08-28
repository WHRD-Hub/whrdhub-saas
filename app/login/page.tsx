"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Input, Label } from "@/components/ui/field";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign in failed. Please try again." : null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // A full navigation, not router.push: the session cookie is written by the
    // client and the middleware reads it on the server. Pushing can arrive
    // before the cookie does, and the request bounces back to /login -- which
    // is exactly the "sign in twice" behaviour this replaces.
    window.location.assign(next);
  };

  return (
    <AuthShell
      heading="Welcome back"
      sub="Sign in to your Hub account"
      footer={<>New here? <Link href="/signup" className="text-purple-700 font-bold">Create an account</Link></>}
    >
      <GoogleButton next={next} />

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </div>

        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center rounded-xl bg-purple text-white h-12 text-sm font-bold hover:bg-purple-600 transition-colors disabled:opacity-60">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-xs text-muted text-center">
        Need to report abuse? You can do that{" "}
        <Link href="/report" className="text-purple-700 font-semibold">without an account</Link>.
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
