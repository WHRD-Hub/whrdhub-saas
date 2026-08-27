/**
 * How large an upload the storage plan will actually accept.
 *
 * Supabase enforces a per-object ceiling that comes from the project's plan,
 * not from the bucket: on the Free plan it is 50 MB, and a bucket configured
 * above that is silently capped. Telling someone the limit is 100 MB and then
 * failing at 60 is worse than telling them 50 — they lose the upload and get
 * an HTTP error nobody can act on.
 *
 * Set NEXT_PUBLIC_MAX_UPLOAD_MB to match the plan. Raise it after upgrading;
 * the bucket limits in install.sql are the other half and are already higher.
 */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);

/** Bytes, for comparing against `File.size`. */
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * What to tell someone whose file is too big.
 *
 * A publication is usually oversized because its photographs are embedded at
 * print resolution, so the fix is nearly always compression rather than a
 * smaller document — and saying so is more useful than quoting a number,
 * particularly to a reader on mobile data who would struggle with the large
 * version anyway.
 */
export function tooLargeMessage(bytes: number): string {
  return (
    `That file is ${formatMb(bytes)} MB and the limit is ${MAX_UPLOAD_MB} MB. ` +
    `Most reports this size are carrying print-resolution photographs — running ` +
    `scripts/compress-pdf.sh on it usually brings it under the limit without any ` +
    `visible loss, and makes it far quicker to open on a phone.`
  );
}
