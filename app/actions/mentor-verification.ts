"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/current-user";
import {
  ALLOWED_DOC_TYPES, MAX_DOCS, MAX_DOC_BYTES, MENTOR_BUCKET, statusFromDocs,
  type DocKind, type MentorDoc, type MentorStatus,
} from "@/lib/mentor-verification";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = () => createAdminClient() as any;

async function currentRow(userId: string): Promise<{ status: MentorStatus; documents: MentorDoc[] }> {
  const { data } = await admin().from("mentor_verifications").select("status, documents").eq("user_id", userId).maybeSingle();
  return { status: (data?.status as MentorStatus) ?? "not_submitted", documents: (data?.documents as MentorDoc[]) ?? [] };
}

async function save(userId: string, patch: Record<string, unknown>) {
  return admin().from("mentor_verifications").upsert({ user_id: userId, updated_at: new Date().toISOString(), ...patch }, { onConflict: "user_id" });
}

/** A mentor adds an ID or accreditation document. Optional, and can be done at onboarding or any time after. */
export async function uploadMentorDocument(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const file = formData.get("file");
  const kind = formData.get("kind") === "id" ? "id" : formData.get("kind") === "accreditation" ? "accreditation" : null;
  if (!(file instanceof File) || !kind) return { error: "Choose a file first." };
  if (!ALLOWED_DOC_TYPES.includes(file.type)) return { error: "Upload a PDF or an image (JPG, PNG or WebP)." };
  if (file.size > MAX_DOC_BYTES) return { error: "That file is over 10 MB." };

  const { status, documents } = await currentRow(user.id);
  if (documents.length >= MAX_DOCS) return { error: "You have reached the limit of documents. Remove one first." };

  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
  const up = await admin().storage.from(MENTOR_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { error: "Could not upload that just now. Try again." };

  const next: MentorDoc[] = [...documents, { path, name: file.name.slice(0, 120), kind: kind as DocKind, size: file.size, uploaded_at: new Date().toISOString(), status: "pending", note: null }];
  const { error } = await save(user.id, {
    documents: next,
    status: statusFromDocs(next, status === "verified" ? "under_review" : status),
    submitted_at: new Date().toISOString(),
  });
  if (error) {
    await admin().storage.from(MENTOR_BUCKET).remove([path]);
    return { error: "Could not save that just now. Try again." };
  }
  revalidatePath("/profile");
  revalidatePath("/mentorship");
  revalidatePath("/hub/mentors");
  return { ok: true, documents: next };
}

/** A mentor removes one of their own documents. */
export async function removeMentorDocument(path: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  const { status, documents } = await currentRow(user.id);
  if (!documents.some((d) => d.path === path)) return { error: "That document could not be found." };
  const next = documents.filter((d) => d.path !== path);
  await save(user.id, { documents: next, status: statusFromDocs(next, status === "verified" ? "under_review" : status) });
  await admin().storage.from(MENTOR_BUCKET).remove([path]);
  revalidatePath("/profile");
  revalidatePath("/hub/mentors");
  return { ok: true, documents: next };
}

async function requireHubAdmin() {
  const user = await getCurrentUser();
  return user?.profile?.is_hub_admin ? user : null;
}

/** An admin marks one document verified or rejected, with a reason when rejecting. */
export async function reviewMentorDocument(mentorId: string, path: string, decision: "verified" | "rejected", note?: string) {
  const reviewer = await requireHubAdmin();
  if (!reviewer) return { error: "Hub admins only." };
  if (reviewer.id === mentorId) return { error: "You cannot review your own documents." };
  if (decision === "rejected" && !note?.trim()) return { error: "Say what is wrong with it, so the mentor can fix it." };
  const { status, documents } = await currentRow(mentorId);
  const next = documents.map((d) => (d.path === path ? { ...d, status: decision, note: note?.trim() || null } : d));
  await save(mentorId, { documents: next, status: statusFromDocs(next, status) });
  revalidatePath(`/hub/mentors/${mentorId}`);
  revalidatePath("/hub/mentors");
  return { ok: true };
}

/** An admin's decision on the mentor as a whole. The mentor is told, with the reason if there is one. */
export async function decideMentor(mentorId: string, decision: "verified" | "rejected", notes?: string) {
  const reviewer = await requireHubAdmin();
  if (!reviewer) return { error: "Hub admins only." };
  if (reviewer.id === mentorId) return { error: "You cannot review your own verification." };
  if (decision === "rejected" && !notes?.trim()) return { error: "Say what the mentor needs to fix." };
  const { documents } = await currentRow(mentorId);
  if (decision === "verified" && !documents.length) return { error: "There are no documents to verify." };

  const next = decision === "verified" ? documents.map((d) => (d.status === "rejected" ? d : { ...d, status: "verified" as const })) : documents;
  const { error } = await save(mentorId, {
    status: decision,
    documents: next,
    review_notes: notes?.trim() || null,
    reviewed_by: reviewer.id,
    reviewed_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save that just now." };

  await admin().from("notifications").insert({
    user_id: mentorId,
    type: "mentor_verification",
    title: decision === "verified" ? "You are verified as a femtor" : "Your femtor documents need attention",
    body: decision === "verified" ? "The Hub has checked your documents. Thank you." : notes!.trim().slice(0, 300),
    link: "/profile?section=verification",
  });
  revalidatePath(`/hub/mentors/${mentorId}`);
  revalidatePath("/hub/mentors");
  revalidatePath("/profile");
  return { ok: true };
}
