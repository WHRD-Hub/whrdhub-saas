import { createClient } from "@/lib/supabase/client";

/**
 * Upload a profile avatar to Supabase Storage.
 * Path: avatars/{userId}/avatar.{ext}
 * Returns the public URL on success.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  // Upsert - overwrite any existing avatar
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("Avatar upload error:", error);
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Append cache-buster so browsers don't show stale avatar
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url, error: null };
}

/**
 * Delete the user's avatar from storage.
 */
export async function deleteAvatar(
  userId: string
): Promise<{ error: string | null }> {
  const supabase = createClient();

  // List all files in the user's avatar folder and delete them
  const { data: files } = await supabase.storage
    .from("avatars")
    .list(userId);

  if (files && files.length > 0) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    const { error } = await supabase.storage.from("avatars").remove(paths);
    if (error) return { error: error.message };
  }

  return { error: null };
}

/**
 * Upload report screenshots to Supabase Storage.
 * Path: report-screenshots/{userId}/{timestamp}_{filename}
 * Returns an array of storage paths (permanent, can generate signed URLs on demand).
 * If userId is empty, it will be resolved from the current auth session.
 */
export async function uploadReportScreenshots(
  userId: string,
  files: File[]
): Promise<{ urls: string[]; errors: string[] }> {
  const supabase = createClient();
  const urls: string[] = [];
  const errors: string[] = [];

  // Resolve userId from auth session if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { urls: [], errors: ["Not authenticated. Please log in first."] };
    }
    resolvedUserId = user.id;
  }

  for (const file of files) {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${resolvedUserId}/${timestamp}_${safeName}`;

    const { error } = await supabase.storage
      .from("report-screenshots")
      .upload(path, file, { contentType: file.type });

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
      continue;
    }

    // Store the permanent storage path - signed URLs can be generated on demand
    urls.push(path);
  }

  return { urls, errors };
}

/**
 * Upload a recorded voice note to the same private bucket as report evidence.
 * Returns the storage path, or null if it could not be saved. Needs a signed-in
 * session, because the bucket only accepts files into the uploader's own folder.
 */
export async function uploadReportVoiceNote(blob: Blob): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const path = `${user.id}/voice_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("report-screenshots").upload(path, blob, { contentType: blob.type || "audio/webm" });
  return error ? null : path;
}
