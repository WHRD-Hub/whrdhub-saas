"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Please use a password of at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, user_type: "defender" },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setCheckEmail(true);
      setLoading(false);
      return;
    }
    // Full navigation for the same reason as sign-in: the middleware must see
    // the session cookie, and a client push can outrun it.
    // The rule below recommends router.push, which is what this replaced: the
    // session cookie is written by the client and read by the middleware on the
    // server, and a client-side push can arrive before the cookie does,
    // bouncing the request straight back to /login. A full navigation
    // guarantees the cookie is sent. The correct alternative is a server action
    // that sets the cookie and redirects; until auth moves there, this stays.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/onboarding");
  };

  if (checkEmail) {
    return (
      <AuthShell heading="Check your email" sub="One more step to get started">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-050 text-purple flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7" />
          </div>
          <p className="mt-4 text-sm text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{email}</span>.
            Open it to finish setting up your account.
          </p>
          <Button href="/login" variant="outline" className="mt-5 w-full">Go to log in</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Join the Hub"
      sub="One account works across the Hub and reporting platform"
      footer={<>Already a member? <Link href="/login" className="text-purple-700 font-bold">Log in</Link></>}
    >
      <GoogleButton next="/onboarding" label="Sign up with Google" />

      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-muted">or with email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>

        {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center rounded-xl bg-purple text-white h-12 text-sm font-bold hover:bg-purple-600 transition-colors disabled:opacity-60">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
