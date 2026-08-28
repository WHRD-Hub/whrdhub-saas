/**
 * Peel the filters that sit in front of a JPEG payload.
 *
 * A PDF image stream carries a chain of filters, applied in order. What we want
 * is the JPEG an image decoder can read, which means undoing everything layered
 * on top of it. Most producers write `/DCTDecode` alone, but plenty wrap it:
 * ReportLab emits `[/ASCII85Decode /DCTDecode]`, and Flate-over-DCT turns up too.
 *
 * Only the transport encodings are handled here. `DCTDecode` itself is left for
 * the image decoder, which is the whole point.
 */

/** ASCII85, as PDF uses it: 'z' for four zero bytes, '~>' terminates. */
export function ascii85Decode(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let tuple = 0;
  let count = 0;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === 0x7e) break;                       // '~' begins the '~>' terminator
    if (c <= 0x20 || c === 0x0a || c === 0x0d) continue;  // whitespace is skipped
    if (c === 0x7a && count === 0) {             // 'z' is shorthand for \0\0\0\0
      out.push(0, 0, 0, 0);
      continue;
    }
    if (c < 0x21 || c > 0x75) continue;          // outside '!'..'u': not our data

    tuple = tuple * 85 + (c - 0x21);
    if (++count === 5) {
      out.push((tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff);
      tuple = 0;
      count = 0;
    }
  }

  // A partial group encodes count-1 bytes, padded with 'u' (84).
  if (count > 0) {
    for (let i = count; i < 5; i++) tuple = tuple * 85 + 84;
    const bytes = [(tuple >>> 24) & 0xff, (tuple >>> 16) & 0xff, (tuple >>> 8) & 0xff, tuple & 0xff];
    out.push(...bytes.slice(0, count - 1));
  }

  return new Uint8Array(out);
}

/** ASCIIHex, as PDF uses it: '>' terminates, an odd final digit is padded with 0. */
export function asciiHexDecode(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let hi = -1;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === 0x3e) break; // '>'
    let v: number;
    if (c >= 0x30 && c <= 0x39) v = c - 0x30;
    else if (c >= 0x41 && c <= 0x46) v = c - 0x37;
    else if (c >= 0x61 && c <= 0x66) v = c - 0x57;
    else continue;
    if (hi < 0) hi = v;
    else { out.push((hi << 4) | v); hi = -1; }
  }
  if (hi >= 0) out.push(hi << 4);
  return new Uint8Array(out);
}

/**
 * Inflate, via the platform. DecompressionStream ships in every browser this
 * app supports and in Node 18+, so a zlib dependency would buy nothing.
 */
export async function flateDecode(input: Uint8Array): Promise<Uint8Array> {
  const tryWith = async (format: "deflate" | "deflate-raw") => {
    const ds = new DecompressionStream(format);
    const stream = new Blob([input as BlobPart]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  try {
    return await tryWith("deflate");
  } catch {
    // Some producers omit the zlib header.
    return await tryWith("deflate-raw");
  }
}

/**
 * Undo every filter ahead of the trailing DCTDecode and return the JPEG.
 * Returns null when the chain does not end in DCTDecode, or contains a stage
 * we do not handle — in which case the caller must leave the image alone.
 */
export async function jpegPayload(
  raw: Uint8Array,
  filters: string[],
): Promise<Uint8Array | null> {
  if (filters.length === 0) return null;
  if (filters[filters.length - 1] !== "DCTDecode") return null;

  let bytes = raw;
  for (const filter of filters.slice(0, -1)) {
    switch (filter) {
      case "ASCII85Decode": bytes = ascii85Decode(bytes); break;
      case "ASCIIHexDecode": bytes = asciiHexDecode(bytes); break;
      case "FlateDecode": bytes = await flateDecode(bytes); break;
      default: return null; // an encoding we do not understand
    }
  }

  // A JPEG always starts FF D8. If it does not, we peeled something wrongly and
  // must not write the result back into the document.
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  return bytes;
}
