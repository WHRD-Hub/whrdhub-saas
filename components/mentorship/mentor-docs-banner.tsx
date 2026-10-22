"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import type { DocKind } from "@/lib/mentor-verification";

/**
 * A reminder, on the femtorship page, for a femtor whose documents are not all in.
 * It can be closed, but only for this visit: it comes back the next time they open
 * the page, until the ID and accreditation are uploaded.
 */
export function MentorDocsBanner({ missing }: { missing: DocKind[] }) {
  const [open, setOpen] = useState(true);
  if (!open || !missing.length) return null;
  const what = missing.length === 2 ? "your ID and accreditation documents" : missing[0] === "id" ? "your ID" : "your accreditation documents";
  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-purple/25 bg-purple-050/70 px-4 py-3">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-purple" />
      <p className="min-w-0 flex-1 text-[13px] text-ink">
        <span className="font-semibold">Get verified as a femtor.</span> Upload {what} so the Hub can verify you. It is optional, and only Hub admins can open them.{" "}
        <Link href="/profile?section=verification" className="font-semibold text-purple hover:underline">Upload now</Link>
      </p>
      <button onClick={() => setOpen(false)} aria-label="Dismiss for now" className="shrink-0 rounded-md p-1 text-muted hover:bg-surface hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
