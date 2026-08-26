"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Ends the session for a deleted account. Rendered on the account-deleted
 * page, which every authenticated layout redirects to when it sees the flag,
 * so a deleted account cannot keep using a live session.
 */
export function SignOutOnLoad() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    createClient()
      .auth.signOut()
      .catch(() => {
        /* already signed out */
      });
  }, []);
  return null;
}
