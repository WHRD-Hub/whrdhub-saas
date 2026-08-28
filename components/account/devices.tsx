"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, Tablet, Monitor, HelpCircle, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { describeDevice, deviceName } from "@/lib/user-agent";
import { revokeSession, revokeOtherSessions, type DeviceSession } from "@/app/actions/sessions";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ICON = { phone: Smartphone, tablet: Tablet, desktop: Monitor, unknown: HelpCircle };

/**
 * Where this account is signed in, and how to end any of it.
 *
 * These are real sessions, and removing one really signs that device out — it
 * is not a list the app keeps for its own comfort. That distinction is the
 * whole feature: a woman who suspects somebody else is reading her account
 * needs the button to do what it says, not to quietly forget a device while
 * the other person keeps their access.
 */
export function Devices({ sessions }: { sessions: DeviceSession[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const others = sessions.filter((s) => !s.is_current).length;

  const end = (id: string, label: string) => {
    setBusy(id);
    start(async () => {
      const res = await revokeSession(id);
      setBusy(null);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${label} has been signed out.`);
        router.refresh();
      }
    });
  };

  const endOthers = () => {
    setBusy("all");
    start(async () => {
      const res = await revokeOtherSessions();
      setBusy(null);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          res.count === 1 ? "One other device was signed out." : `${res.count} devices were signed out.`,
        );
        router.refresh();
      }
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-ink">Signed-in devices</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Everywhere this account is currently signed in. If you do not recognise
            something here, sign it out — that device will need your password again.
          </p>
        </div>
        {others > 0 && (
          <button
            type="button"
            onClick={endOthers}
            disabled={pending}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3.5 text-sm font-bold text-ink transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out everywhere else
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-5 text-sm text-muted">
          No other sessions found. If this looks wrong, sign out and back in.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-line">
          {sessions.map((s) => {
            const { kind } = describeDevice(s.user_agent);
            const Icon = ICON[kind];
            const name = deviceName(s.user_agent);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                    s.is_current ? "bg-emerald-50 text-emerald-700" : "bg-purple-050 text-purple",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                    {name}
                    {s.is_current && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <ShieldCheck className="h-3 w-3" /> This device
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {s.ip ? `${s.ip} · ` : ""}
                    active {timeAgo(s.refreshed_at)}
                    {" · "}
                    signed in {timeAgo(s.created_at)}
                  </p>
                </div>

                {s.is_current ? (
                  <span className="shrink-0 text-xs text-muted">Use Sign out to end this one</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => end(s.id, name)}
                    disabled={pending}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-bold text-ink transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                  >
                    {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Sign out
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        An address here is where the device was when it signed in, which is often the
        nearest city rather than yours. Changing your password signs out every device
        except this one.
      </p>
    </section>
  );
}
