import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Stored files on Neon Object Storage (S3-compatible). Server only: the
 * credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_ENDPOINT_URL_S3 /
 * AWS_REGION) are read from the environment by the AWS SDK and must never reach
 * the browser. Browsers upload through a short-lived signed URL handed out by
 * app/api/storage/route.ts, which is where the access rules live.
 */

export const BUCKETS = {
  avatars: { public: true, maxMb: 5 },
  media: { public: true, maxMb: 50 },
  publications: { public: true, maxMb: 100 },
  "report-screenshots": { public: false, maxMb: 25 },
  "mentor-documents": { public: false, maxMb: 10 },
} as const;

export type BucketName = keyof typeof BUCKETS;

export const isBucket = (name: string): name is BucketName => Object.hasOwn(BUCKETS, name);

let client: S3Client | null = null;
function s3(): S3Client {
  // Neon uses path-style addresses: endpoint/bucket/key.
  client ??= new S3Client({ forcePathStyle: true });
  return client;
}

/**
 * Keys come from callers, some of them browsers. Refuse anything that could
 * climb out of its folder or smuggle in an odd path.
 */
export function safeKey(path: string): string | null {
  const key = path.replace(/^\/+/, "");
  if (!key || key.length > 600) return null;
  if (key.split("/").some((part) => part === "" || part === "." || part === "..")) return null;
  if (/[\u0000-\u001f\\]/.test(key)) return null;
  return key;
}

/** Address of a file in a public bucket, on this site's own domain (see the /files rewrite in next.config.ts). */
export function publicPath(bucket: BucketName, key: string): string {
  return `/files/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * How long browsers and the CDN may keep a file. Public files are named
 * uniquely and never rewritten in place, so they are kept for a year: a file
 * served from cache costs nothing to download again. Private files are never cached.
 */
export const cacheControlFor = (bucket: BucketName) =>
  BUCKETS[bucket].public ? "public, max-age=31536000, immutable" : "private, no-store";

/**
 * A URL the browser may PUT exactly one file of exactly this size and type to,
 * for five minutes, plus the headers it must send with it (they are part of
 * what was signed; storage refuses the upload if they differ).
 */
export async function signUpload(bucket: BucketName, key: string, contentType: string, size: number) {
  const cacheControl = cacheControlFor(bucket);
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: cacheControl,
    }),
    { expiresIn: 300, signableHeaders: new Set(["content-type", "cache-control"]) },
  );
  return { url, headers: { "content-type": contentType, "cache-control": cacheControl } };
}

/** A URL that opens one private file for a limited time. */
export function signDownload(bucket: BucketName, key: string, expiresIn: number) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: Math.min(Math.max(expiresIn, 60), 60 * 60 * 24),
  });
}

/**
 * A public file for the site to serve itself. Returns null when no such file exists,
 * so the caller can show a proper page instead of the storage service's own error.
 * Only public buckets may be served this way.
 */
export async function getPublicObject(bucket: BucketName, key: string) {
  if (!BUCKETS[bucket].public) return null;
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
      contentLength: res.ContentLength,
      etag: res.ETag,
      lastModified: res.LastModified,
    };
  } catch (e) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
}

export async function putObject(bucket: BucketName, key: string, body: Uint8Array | Buffer, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControlFor(bucket),
    }),
  );
}

export async function removeObjects(bucket: BucketName, keys: string[]) {
  if (!keys.length) return;
  await s3().send(
    new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
  );
}

export async function listObjects(bucket: BucketName, prefix: string): Promise<{ name: string }[]> {
  const folder = prefix.replace(/^\/+|\/+$/g, "");
  const res = await s3().send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: folder ? `${folder}/` : "", Delimiter: "/", MaxKeys: 1000 }),
  );
  const cut = folder ? folder.length + 1 : 0;
  return (res.Contents ?? []).map((o) => ({ name: (o.Key ?? "").slice(cut) })).filter((o) => o.name);
}
