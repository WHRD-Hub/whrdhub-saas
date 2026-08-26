import Link from "next/link";
import { UserX } from "lucide-react";
import { SignOutOnLoad } from "@/components/account/sign-out-on-load";

export const metadata = { title: "Account deleted — WHRD Hub" };

/**
 * Where a deleted account lands. Signing out happens on arrival so the session
 * cannot be used to keep browsing.
 */
export default function AccountDeletedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4">
      <SignOutOnLoad />
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-purple-050 text-purple">
          <UserX className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-xl font-black text-ink">This account has been deleted</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You have been signed out. If you think this was a mistake, or you would like the
          account brought back, get in touch with the Hub and we can restore it.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/contact"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-purple px-5 text-sm font-bold text-white hover:bg-purple-600"
          >
            Contact the Hub
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
