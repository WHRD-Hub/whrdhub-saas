import manifest from "@/data/file-links.json";
import { HUB_FILE_PREFIX, hubFile } from "@/lib/file-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Addresses that are in print.
 *
 * data/file-links.json records every public file the Hub had in storage when
 * it left Supabase, under the exact bucket and key it was reachable at. Banners,
 * leaflets and QR codes carry those addresses, so they are treated as permanent:
 * a file put back goes to the same key (scripts/file-links.mjs), the Hub never
 * deletes one, and if a document is later replaced through the Hub the old
 * address follows it to the new file.
 *
 * Server only: the list is too large to send to a browser.
 */

type PrintedFile = (typeof manifest.files)[number];

const printed = new Map<string, PrintedFile>(manifest.files.map((f) => [`${f.bucket}/${f.key}`, f]));

/** True when this bucket and key is one of the recorded addresses. */
export function isPrintedFile(bucket: string, key: string): boolean {
  return printed.has(`${bucket}/${key}`);
}

/**
 * Where a recorded address should lead when no file sits at it.
 *
 * Looks up the publication that used the address and returns where its
 * document (or cover) lives now. Returns null when the address was never
 * recorded, the publication is gone or unpublished, or it still points at this
 * same address, in which case the file has simply not been put back yet.
 */
export async function movedTo(bucket: string, key: string): Promise<string | null> {
  const file = printed.get(`${bucket}/${key}`);
  if (!file || file.usedBy.length === 0) return null;

  try {
    const supabase = await createClient();
    for (const use of file.usedBy) {
      const column = use.as === "document" ? "file_url" : "cover_image_url";
      const { data } = await supabase
        .from("resources")
        .select(column)
        .eq("id", use.resource)
        .eq("published", true)
        .maybeSingle();
      const current = hubFile((data as Record<string, string | null> | null)?.[column]);
      if (!current) continue;
      if (decodeURI(current.split("?")[0]) === `${HUB_FILE_PREFIX}${bucket}/${key}`) continue;
      return current;
    }
  } catch (e) {
    console.error("[files] could not look up a moved file", (e as Error).message);
  }
  return null;
}
