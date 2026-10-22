"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { decideMentor, reviewMentorDocument } from "@/app/actions/mentor-verification";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { KIND_LABEL, fileSize, type MentorDoc, type MentorStatus } from "@/lib/mentor-verification";
import { timeAgo } from "@/lib/utils";

type DocView = MentorDoc & { url: string | null };
const DOC_TONE = { pending: "amber", verified: "green", rejected: "red" } as const;
const DOC_LABEL = { pending: "Waiting", verified: "Verified", rejected: "Rejected" } as const;

/** The documents a femtor sent, each one verifiable on its own, and the decision on the mentor as a whole. */
export function MentorReview({
  mentorId, docs, status, reviewNotes, reviewedBy, reviewedAt, own,
}: { mentorId: string; docs: DocView[]; status: MentorStatus; reviewNotes: string | null; reviewedBy: string | null; reviewedAt: string | null; own: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [docNote, setDocNote] = useState("");

  const act = async (tag: string, fn: () => Promise<{ error?: string; ok?: boolean } | undefined>, done: string) => {
    setBusy(tag);
    const res = await fn();
    setBusy(null);
    if (res?.error) return toast.error(res.error);
    toast.success(done);
    setRejecting(null);
    setDocNote("");
    router.refresh();
  };

  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">Documents ({docs.length})</h2>
        {docs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Nothing uploaded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.path} className="space-y-2 px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink" title={d.name}>{d.name}</p>
                    <p className="text-[11px] text-muted">{KIND_LABEL[d.kind]} · {fileSize(d.size)} · sent {timeAgo(d.uploaded_at)}</p>
                  </div>
                  <Pill tone={DOC_TONE[d.status]} className="shrink-0 !px-2 !py-0 text-[10px]">{DOC_LABEL[d.status]}</Pill>
                </div>
                {d.status === "rejected" && d.note && <p className="text-[11px] text-rose-700">{d.note}</p>}
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-semibold text-purple hover:bg-paper">
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {!own && d.status !== "verified" && (
                    <button onClick={() => act(`v-${d.path}`, () => reviewMentorDocument(mentorId, d.path, "verified"), "Document verified.")} disabled={busy !== null} className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                      {busy === `v-${d.path}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Verify
                    </button>
                  )}
                  {!own && d.status !== "rejected" && (
                    <button onClick={() => setRejecting(rejecting === d.path ? null : d.path)} disabled={busy !== null} className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  )}
                </div>
                {rejecting === d.path && (
                  <div className="space-y-1.5">
                    <input value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="What is wrong with it? The mentor will see this." className="h-8 w-full rounded-md border border-line bg-surface px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple/30" />
                    <button onClick={() => act(`r-${d.path}`, () => reviewMentorDocument(mentorId, d.path, "rejected", docNote), "Document rejected.")} disabled={busy !== null} className="inline-flex h-7 items-center rounded-md bg-rose-600 px-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                      Reject with this reason
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2.5 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-[13px] font-semibold text-ink">Decision</h2>
        {status !== "not_submitted" && status !== "under_review" && (
          <p className="text-xs text-muted">
            {status === "verified" ? "Verified" : "Sent back"}{reviewedBy ? ` by ${reviewedBy}` : ""}{reviewedAt ? `, ${timeAgo(reviewedAt)}` : ""}.
            {reviewNotes ? ` “${reviewNotes}”` : ""}
          </p>
        )}
        {own ? (
          <p className="text-xs text-muted">You cannot review your own verification. Another Hub admin needs to.</p>
        ) : (
          <>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Note to the mentor (needed if you send it back)" className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple/30" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => act("verify", () => decideMentor(mentorId, "verified", notes), "Mentor verified. They have been told.")} disabled={busy !== null || docs.length === 0} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-purple px-3 text-xs font-semibold text-white hover:bg-purple-600 disabled:opacity-50">
                {busy === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Verify mentor
              </button>
              <button onClick={() => act("reject", () => decideMentor(mentorId, "rejected", notes), "Sent back to the mentor.")} disabled={busy !== null || docs.length === 0} className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50">
                Send back
              </button>
            </div>
          </>
        )}
      </section>
    </aside>
  );
}
