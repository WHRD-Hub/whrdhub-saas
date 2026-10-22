"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, IdCard, Loader2, Trash2, Upload } from "lucide-react";
import { removeMentorDocument, uploadMentorDocument } from "@/app/actions/mentor-verification";
import { Pill } from "@/components/ui/pill";
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, fileSize, type DocKind, type MentorDoc, type MentorStatus } from "@/lib/mentor-verification";

const SLOTS: { kind: DocKind; title: string; hint: string; icon: typeof FileText }[] = [
  { kind: "id", title: "Your ID", hint: "National ID or passport. Only Hub admins can open it.", icon: IdCard },
  { kind: "accreditation", title: "Accreditation", hint: "A certificate, licence or letter showing your training or standing.", icon: FileText },
];

const DOC_TONE = { pending: "amber", verified: "green", rejected: "red" } as const;
const DOC_LABEL = { pending: "Waiting for review", verified: "Verified", rejected: "Needs attention" } as const;

/**
 * Where a femtor adds the documents that let the Hub verify them: an ID and
 * accreditation. Optional everywhere it appears. Used at onboarding (with its own
 * list, since the page is not reloaded) and in profile settings.
 */
export function MentorDocuments({
  docs: initial, status = "not_submitted", reviewNotes, compact = false,
}: { docs: MentorDoc[]; status?: MentorStatus; reviewNotes?: string | null; compact?: boolean }) {
  const router = useRouter();
  const [docs, setDocs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (kind: DocKind, file: File | undefined) => {
    if (!file) return;
    setBusy(kind);
    setError(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    const res = await uploadMentorDocument(fd);
    setBusy(null);
    if (inputs.current[kind]) inputs.current[kind]!.value = "";
    if (res?.error) return setError(res.error);
    if (res?.documents) setDocs(res.documents as MentorDoc[]);
    router.refresh();
  };

  const remove = async (path: string) => {
    setBusy(path);
    setError(null);
    const res = await removeMentorDocument(path);
    setBusy(null);
    if (res?.error) return setError(res.error);
    if (res?.documents) setDocs(res.documents as MentorDoc[]);
    router.refresh();
  };

  const live: MentorStatus = !docs.length ? "not_submitted" : status === "not_submitted" ? "under_review" : status;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[live]}>{STATUS_LABEL[live]}</Pill>
          <p className="text-xs text-muted">
            {live === "verified" ? "A Hub admin has checked your documents." : live === "under_review" ? "A Hub admin will look at them. You do not need to do anything." : "Optional, but it lets the Hub verify you as a femtor."}
          </p>
        </div>
      )}
      {live === "rejected" && reviewNotes && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-900"><span className="font-semibold">From the Hub:</span> {reviewNotes}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {SLOTS.map(({ kind, title, hint, icon: Icon }) => {
          const mine = docs.filter((d) => d.kind === kind);
          return (
            <div key={kind} className="rounded-xl border border-line bg-surface p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Icon className="h-4 w-4 text-purple" />{title}</p>
              <p className="mt-0.5 text-xs text-muted">{hint}</p>

              {mine.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {mine.map((d) => (
                    <li key={d.path} className="rounded-lg border border-line bg-paper/60 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={d.name}>{d.name}</span>
                        <Pill tone={DOC_TONE[d.status]} className="shrink-0 !px-2 !py-0 text-[10px]">{DOC_LABEL[d.status]}</Pill>
                        <button onClick={() => remove(d.path)} disabled={busy !== null} aria-label={`Remove ${d.name}`} className="shrink-0 text-muted hover:text-rose-600 disabled:opacity-50">
                          {busy === d.path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted">{KIND_LABEL[d.kind]} · {fileSize(d.size)}</p>
                      {d.status === "rejected" && d.note && <p className="mt-1 text-[11px] text-rose-700">{d.note}</p>}
                    </li>
                  ))}
                </ul>
              )}

              <input ref={(el) => { inputs.current[kind] = el; }} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" id={`mentor-doc-${kind}`} onChange={(e) => upload(kind, e.target.files?.[0])} />
              <label htmlFor={`mentor-doc-${kind}`} className={`mt-2.5 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:bg-paper ${busy !== null ? "pointer-events-none opacity-60" : ""}`}>
                {busy === kind ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {mine.length ? "Add another" : "Upload"}
              </label>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted">PDF or image, up to 10 MB each. Stored privately; only Hub admins reviewing you can open them.</p>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
