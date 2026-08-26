"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { claimAccount } from "@/app/actions/account";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Turning an anonymous reporting account into a real one.
 *
 * The account itself does not change - same id, same reports - so nothing has
 * to be migrated. All that changes is that it gains an address the person can
 * actually recover, and stops being flagged anonymous.
 */
export function ClaimAccount({ username }: { username?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    start(async () => {
      const res = await claimAccount({
        email,
        password: password || undefined,
        full_name: fullName || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Your account is now linked to that address.");
      router.refresh();
    });
  };

  return (
    <section className="rounded-2xl border border-purple/20 bg-purple-050/50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-purple">
          <KeyRound className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-black text-ink">Secure this account</h2>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
            You are signed in as{" "}
            <span className="font-mono font-semibold text-ink">{username || "an anonymous reporter"}</span>.
            That works, but if you lose the password there is no way back in, because
            there is no address to send a reset to. Adding one keeps every report you
            have already filed and lets you join a county network.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="claim-email">Email address</Label>
          <Input
            id="claim-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label htmlFor="claim-name">Your name (optional)</Label>
          <Input
            id="claim-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="How you want to appear"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="claim-password">New password (optional)</Label>
          <Input
            id="claim-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep the one you have"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || !email}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Link my account
        </Button>
        <p className="text-xs text-muted">
          Your reports stay exactly as they are, and stay private to you.
        </p>
      </div>
    </section>
  );
}
