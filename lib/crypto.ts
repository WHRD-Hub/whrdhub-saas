import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/**
 * Application-level encryption for sensitive columns (report text, contact
 * details, location, USSD phone numbers).
 *
 * The database only ever holds ciphertext, so a copy of the rows, a backup or a
 * read-only database login reveals nothing without the key, which lives only
 * in the server's environment (Vercel), never in the database.
 *
 *   token  = v1:<keyId>:<iv>:<tag>:<ciphertext>      (base64url parts)
 *   cipher = AES-256-GCM, a fresh 96-bit IV for every value
 *   AAD    = "<table>.<column>.<row id>", so a value cannot be copied to another
 *            column or row and still decrypt
 *
 * Keys: DATA_ENCRYPTION_KEYS="k1:<base64 32 bytes>[,k0:<base64 32 bytes>]".
 * The first (or DATA_ENCRYPTION_ACTIVE) encrypts; every listed key can decrypt,
 * so a key can be rotated by adding a new one first and re-encrypting.
 * BLIND_INDEX_KEY (base64, 32+ bytes) keys the HMAC used to look a phone number
 * up without storing it. Never change it once reports exist.
 */

const PREFIX = "v1";
let ring: { active: string; keys: Map<string, Buffer> } | null = null;

function loadRing() {
  if (ring) return ring;
  const raw = process.env.DATA_ENCRYPTION_KEYS?.trim();
  if (!raw) throw new Error("DATA_ENCRYPTION_KEYS is not set: refusing to store sensitive data unencrypted.");
  const keys = new Map<string, Buffer>();
  for (const part of raw.split(",")) {
    const i = part.indexOf(":");
    if (i < 1) throw new Error("DATA_ENCRYPTION_KEYS must look like k1:<base64 key>[,k0:<base64 key>].");
    const id = part.slice(0, i).trim();
    const key = Buffer.from(part.slice(i + 1).trim(), "base64");
    if (key.length !== 32) throw new Error(`Encryption key "${id}" must be exactly 32 bytes (base64).`);
    keys.set(id, key);
  }
  const active = process.env.DATA_ENCRYPTION_ACTIVE?.trim() || [...keys.keys()][0];
  if (!keys.has(active)) throw new Error(`DATA_ENCRYPTION_ACTIVE "${active}" is not in DATA_ENCRYPTION_KEYS.`);
  ring = { active, keys };
  return ring;
}

const b64 = (b: Buffer) => b.toString("base64url");

/** True when both the encryption keys and the blind-index key are present and well formed. */
export function encryptionConfigured(): boolean {
  try { loadRing(); blindIndex("check"); return true; } catch { return false; }
}

/** True for a value this module produced. Plain legacy text returns false. */
export const isEncrypted = (v: unknown): v is string => typeof v === "string" && v.startsWith(PREFIX + ":");

export function encryptString(plain: string, aad: string): string {
  const { active, keys } = loadRing();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keys.get(active)!, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [PREFIX, active, b64(iv), b64(c.getAuthTag()), b64(ct)].join(":");
}

export function decryptString(token: string, aad: string): string {
  const [v, kid, iv, tag, ct] = token.split(":");
  if (v !== PREFIX || !kid || !iv || !tag || ct === undefined) throw new Error("Not an encrypted value.");
  const key = loadRing().keys.get(kid);
  if (!key) throw new Error(`No key "${kid}" to decrypt with.`);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Encrypt any JSON-able value (arrays, numbers, objects). null and undefined stay null. */
export function sealValue(value: unknown, aad: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  return encryptString(JSON.stringify(value), aad);
}

/** Reverse of sealValue. Plain legacy values pass through so old rows keep working until they are re-encrypted. */
export function openValue<T = unknown>(token: unknown, aad: string): T | null {
  if (token === null || token === undefined) return null;
  if (!isEncrypted(token)) return token as T;
  return JSON.parse(decryptString(token, aad)) as T;
}

/**
 * A keyed fingerprint for exact-match lookup (a phone number) without storing
 * the number. Not reversible, and useless without BLIND_INDEX_KEY.
 */
export function blindIndex(value: string): string {
  const raw = process.env.BLIND_INDEX_KEY?.trim();
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length < 32) throw new Error("BLIND_INDEX_KEY is not set (base64, at least 32 bytes).");
  return createHmac("sha256", key).update(value.replace(/\s+/g, "").toLowerCase()).digest("hex");
}
