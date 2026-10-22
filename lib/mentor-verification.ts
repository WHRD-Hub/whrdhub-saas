/**
 * Mentor (femtor) verification. A mentor can optionally upload an ID and
 * accreditation documents; a Hub admin reviews them. The states follow Sauti
 * Salama's: nothing sent, under review, verified, or rejected with a reason.
 */
export const MENTOR_BUCKET = "mentor-documents";
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const MAX_DOCS = 12;
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export type DocKind = "id" | "accreditation";
export type DocStatus = "pending" | "verified" | "rejected";
export type MentorStatus = "not_submitted" | "under_review" | "verified" | "rejected";

export interface MentorDoc {
  path: string;
  name: string;
  kind: DocKind;
  size: number;
  uploaded_at: string;
  status: DocStatus;
  note?: string | null;
}

export const KIND_LABEL: Record<DocKind, string> = { id: "ID", accreditation: "Accreditation" };

export const STATUS_LABEL: Record<MentorStatus, string> = {
  not_submitted: "Nothing sent",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Needs attention",
};

export const STATUS_TONE: Record<MentorStatus, "slate" | "amber" | "green" | "red"> = {
  not_submitted: "slate",
  under_review: "amber",
  verified: "green",
  rejected: "red",
};

/** What a mentor still owes: both an ID and at least one accreditation document. */
export function missingDocs(docs: MentorDoc[]): DocKind[] {
  const live = docs.filter((d) => d.status !== "rejected");
  const missing: DocKind[] = [];
  if (!live.some((d) => d.kind === "id")) missing.push("id");
  if (!live.some((d) => d.kind === "accreditation")) missing.push("accreditation");
  return missing;
}

/** The status that follows from the documents alone; a decision by an admin overrides it. */
export function statusFromDocs(docs: MentorDoc[], current: MentorStatus): MentorStatus {
  if (!docs.length) return "not_submitted";
  if (docs.some((d) => d.status === "rejected") && !docs.some((d) => d.status === "pending")) return "rejected";
  if (current === "verified" && docs.every((d) => d.status === "verified")) return "verified";
  return docs.some((d) => d.status === "pending") ? "under_review" : current === "verified" ? "verified" : "under_review";
}

export const fileSize = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
