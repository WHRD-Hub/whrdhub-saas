"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Trash2, Download, Mail, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/field";
import { MediaUploader, type MediaItem } from "@/components/composer/media-uploader";
import { RESOURCE_KINDS, type ResourceItem } from "@/lib/resource-types";
import { StorageCheck } from "@/components/hub/storage-check";
import { createResource, updateResource, deleteResource } from "@/app/actions/resources";
import { cn } from "@/lib/utils";
import { hubFile } from "@/lib/file-url";
import { MAX_UPLOAD_MB } from "@/lib/upload-limits";

const blank = {
  title: "",
  description: "",
  kind: "Report",
  is_newsletter: false,
  cover_image_url: "",
  file_url: "",
  edition_label: "",
  published_on: "",
  featured: false,
  published: true,
  sort_order: 0,
};

type Draft = typeof blank;

function fromItem(item: ResourceItem): Draft {
  return {
    title: item.title,
    description: item.description ?? "",
    kind: item.kind,
    is_newsletter: item.is_newsletter,
    cover_image_url: item.cover_image_url ?? "",
    file_url: item.file_url,
    edition_label: item.edition_label ?? "",
    published_on: item.published_on ?? "",
    featured: item.featured,
    published: item.published,
    sort_order: item.sort_order,
  };
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-colors",
        checked ? "border-purple/40 bg-purple-050" : "border-line bg-surface hover:bg-purple-050/40",
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "w-10 h-6 rounded-full shrink-0 relative transition-colors",
            checked ? "bg-purple" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
              checked ? "left-[1.125rem]" : "left-0.5",
            )}
          />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">{label}</span>
          {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
        </span>
      </span>
    </button>
  );
}

/**
 * Create/edit form for a resource document. Admins can upload the PDF and the
 * cover straight into the `media` bucket, or paste links to files that already
 * live on whrdhub.org. Tagging an item as a newsletter moves it to /newsletter.
 */
export function ResourceForm({ item }: { item?: ResourceItem }) {
  const router = useRouter();
  const editing = !!item;
  const [d, setD] = useState<Draft>(item ? fromItem(item) : blank);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((p) => ({ ...p, [key]: value }));

  const coverValue: MediaItem[] = d.cover_image_url
    ? [{ type: "image", url: d.cover_image_url, name: "cover" }]
    : [];
  const fileValue: MediaItem[] = d.file_url
    ? [{ type: "document", url: d.file_url, name: d.title || "document" }]
    : [];

  const save = async () => {
    setBusy("save");
    setError(null);
    setMsg(null);
    const payload = {
      title: d.title,
      description: d.description,
      kind: d.kind,
      is_newsletter: d.is_newsletter,
      cover_image_url: d.cover_image_url,
      file_url: d.file_url,
      edition_label: d.edition_label,
      published_on: d.published_on || null,
      featured: d.featured,
      published: d.published,
      sort_order: Number(d.sort_order) || 0,
    };
    const res = (editing && item
      ? await updateResource(item.id, payload)
      : await createResource(payload)) as { error?: string; warnings?: string[] };
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    // A file we could not copy into storage is worth showing before moving on.
    const notes = res.warnings ?? [];
    if (notes.length) {
      setWarnings(notes);
      setMsg("Saved. Some files are still hosted elsewhere — see below.");
      router.refresh();
      return;
    }
    router.push("/hub/resources");
    router.refresh();
  };

  const remove = async () => {
    if (!item) return;
    setBusy("delete");
    setError(null);
    const res = (await deleteResource(item.id)) as { error?: string };
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.push("/hub/resources");
    router.refresh();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/hub/resources" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Resources
      </Link>

      <div>
        <h1 className="text-2xl font-black text-ink">{editing ? "Edit document" : "Add a document"}</h1>
        <p className="text-sm text-muted mt-1">
          Reports, research, guides, policy briefs and photo books appear on the public Resources
          page. Tag an item as a newsletter and it moves to the Newsletter page instead.
        </p>
      </div>

      {/* Where it will appear */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle
          checked={!d.is_newsletter}
          onChange={(v) => set("is_newsletter", !v)}
          label="Resource"
          hint="Shows in the downloads grid on /resources"
        />
        <Toggle
          checked={d.is_newsletter}
          onChange={(v) => set("is_newsletter", v)}
          label="Newsletter"
          hint="Shows as an edition on /newsletter"
        />
      </div>

      <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="Annual Report 2026" />
        </div>

        <div>
          <Label>
            Short description <span className="text-muted font-normal">(optional)</span>
          </Label>
          <Textarea
            rows={3}
            value={d.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="One or two lines about what is inside."
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {!d.is_newsletter ? (
            <div>
              <Label>Type</Label>
              <select
                value={d.kind}
                onChange={(e) => set("kind", e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-purple/30"
              >
                {RESOURCE_KINDS.filter((k) => k !== "Newsletter").map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <Label>
                Edition label <span className="text-muted font-normal">(optional)</span>
              </Label>
              <Input
                value={d.edition_label}
                onChange={(e) => set("edition_label", e.target.value)}
                placeholder="January – June 2026"
              />
            </div>
          )}
          <div>
            <Label>
              Date <span className="text-muted font-normal">(optional)</span>
            </Label>
            <Input type="date" value={d.published_on} onChange={(e) => set("published_on", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Files */}
      <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
        <p className="rounded-lg bg-purple-050 border border-purple/20 px-3.5 py-2.5 text-xs text-purple-700 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Files are stored in the Hub&apos;s own storage. Uploads go straight there, and a link you
            paste is downloaded and copied in when you save, so the document keeps working even if
            the original site goes away.
          </span>
        </p>
        <StorageCheck bucket="publications" />
        <div>
          <Label>Cover image</Label>
          <p className="text-xs text-muted mb-2">
            The thumbnail readers see. A portrait shot of the front page works best.
          </p>
          <MediaUploader
            value={coverValue}
            onChange={(v) => set("cover_image_url", v.slice(-1)[0]?.url ?? "")}
            bucket="publications"
            folder="covers"
            accept="image/*"
          />
          <Input
            className="mt-2"
            value={d.cover_image_url}
            onChange={(e) => set("cover_image_url", e.target.value)}
            placeholder="…or paste a cover image link"
          />
        </div>

        <div>
          <Label>The document</Label>
          <p className="text-xs text-muted mb-2">
            Upload the PDF, or paste a link to one already online. A report over{" "}
            {MAX_UPLOAD_MB} MB is compressed in your browser before it uploads — the
            photographs are made smaller, the text stays searchable, and the original
            on your computer is untouched.
          </p>
          <MediaUploader
            value={fileValue}
            onChange={(v) => set("file_url", v.slice(-1)[0]?.url ?? "")}
            bucket="publications"
            folder="documents"
            accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf"
            // Only fills an empty cover: a cover somebody chose deliberately is
            // never replaced by a generated one.
            onCoverDerived={(url) => set("cover_image_url", d.cover_image_url || url)}
          />
          <Input
            className="mt-2"
            value={d.file_url}
            onChange={(e) => set("file_url", e.target.value)}
            placeholder="https://…/document.pdf"
          />
        </div>
      </div>

      {/* Visibility */}
      <div className="rounded-xl border border-line bg-surface p-5 space-y-3">
        <Toggle
          checked={d.published}
          onChange={(v) => set("published", v)}
          label="Published"
          hint="Turn this off to hide the document from the public pages without deleting it."
        />
        {d.is_newsletter && (
          <Toggle
            checked={d.featured}
            onChange={(v) => set("featured", v)}
            label="Latest edition"
            hint="Shown large at the top of the Newsletter page. Only one edition can hold this."
          />
        )}
        <div className="pt-1">
          <Label>Order</Label>
          <p className="text-xs text-muted mb-2">Lower numbers show first. Leave at 0 if you don&apos;t mind.</p>
          <Input
            type="number"
            className="max-w-[140px]"
            value={d.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value) as Draft["sort_order"])}
          />
        </div>
      </div>

      {/* Preview */}
      {(d.title || d.cover_image_url) && (
        <div className="rounded-xl border border-line bg-paper p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">
            How it will look on {d.is_newsletter ? "/newsletter" : "/resources"}
          </p>
          <div className="max-w-[220px] rounded-2xl border border-line bg-surface overflow-hidden">
            <div className="aspect-[3/4] bg-paper overflow-hidden grid place-items-center">
              {d.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hubFile(d.cover_image_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <FileText className="w-8 h-8 text-muted" />
              )}
            </div>
            <div className="p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                {d.is_newsletter ? d.edition_label || "Newsletter" : d.kind}
              </span>
              <p className="mt-1 font-bold text-ink text-sm leading-snug">{d.title || "Untitled document"}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-purple">
                {d.is_newsletter ? <Mail className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                {d.is_newsletter ? "Read the newsletter" : "Download PDF"}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700 font-semibold">{msg}</p>}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Kept the original link
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">
            The document still works, but it is served from another site. Try uploading the file
            directly instead.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-xl bg-purple text-white px-5 h-11 text-sm font-bold hover:bg-purple-600 disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editing ? "Save changes" : "Add document"}
        </button>
        <Link
          href="/hub/resources"
          className="inline-flex items-center rounded-xl border border-line bg-surface px-4 h-11 text-sm font-bold text-ink hover:bg-purple-050"
        >
          Cancel
        </Link>

        {editing && (
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-muted">Delete for good?</span>
                <button
                  onClick={remove}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 text-white px-4 h-11 text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-line bg-surface px-4 h-11 text-sm font-bold text-ink hover:bg-purple-050"
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 h-11 text-sm font-bold hover:bg-rose-100"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
