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
 * This is the message of last resort. An oversized PDF is compressed in the
 * browser first (see lib/pdf/shrink.ts), so by the time anyone reads this,
 * either the file is not a PDF or compressing it did not free enough — which
 * means its weight is not in its photographs.
 */
export function tooLargeMessage(bytes: number): string {
  return (
    `That file is ${formatMb(bytes)} MB and the limit is ${MAX_UPLOAD_MB} MB. ` +
    `If it is a scanned document, every page is one large picture and there is ` +
    `little to compress — splitting it into parts is the way through.`
  );
}
