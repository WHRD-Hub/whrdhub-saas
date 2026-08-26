import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Account suspended — WHRD Hub" };

/**
 * Where a banned account lands.
 *
 * The session is left alive on purpose, unlike a deleted account: the person
 * should be able to read what was decided and why, and reporting stays open to
 * them. Being barred from the community is not a reason to be barred from help.
 */
export default async function AccountSuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reason: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("ban_reason")
      .eq("id", user.id)
      .maybeSingle();
    reason = (data?.ban_reason as string) ?? null;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-black text-ink">Your account is suspended</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The Hub has paused your access to the community. You cannot post, comment or
          support other members while this is in place.
        </p>

        {reason && (
          <p className="mt-4 rounded-xl border border-line bg-paper p-3 text-left text-sm text-ink">
            {reason}
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted">
          If you need help or are in danger, reporting is still open to you. Being
          suspended from the community does not close that door.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/report"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-magenta px-5 text-sm font-bold text-white hover:brightness-95"
          >
            Report abuse
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600"
          >
            Appeal to the Hub
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-bold text-ink hover:bg-purple-050"
          >
            Back to the website
          </Link>
        </div>
      </div>
    </main>
  );
}
