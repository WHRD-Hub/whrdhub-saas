"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";

/**
 * Signing out through a server action, so the cookie is cleared before the
 * response is written rather than in the browser and hoped for afterwards. A
 * client-side sign-out that races its own navigation can leave the next
 * request still carrying a session.
 */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        }
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </form>
  );
}
