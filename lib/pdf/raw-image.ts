/**
 * Reading the images a PDF stores as raw pixels rather than as a JPEG.
 *
 * The first version of the compressor only touched `DCTDecode` streams —
 * photographs already stored as JPEG — and skipped everything else on the
 * grounds that misreading a bitmap corrupts it. That was the right instinct
 * and the wrong cut-off. A book laid out in InDesign or Canva commonly stores
 * its pictures Flate-compressed, and for such a document the compressor found
 * dozens of images, rewrote none of them, and reported that the file simply
 * would not shrink.
 *
 * So this handles the shapes that can be read without guessing: 8-bit grey and
 * 8-bit RGB, which between them cover almost every photograph in a layout
 * document. Anything else — indexed palettes, CMYK, 1-bit scans, JPEG 2000 —
 * still returns null and is left exactly as it was. The rule has not changed,
 * only the size of the set we can honestly claim to understand.
 */

import { PDFName, PDFDict, PDFArray, PDFNumber, type PDFRawStream } from "pdf-lib";
import { flateDecode } from "./filters";

export interface RawImage {
  /** One byte per channel, row-major, no padding. */
  samples: Uint8Array;
  width: number;
  height: number;
  channels: 1 | 3;
}

function nameOf(dict: PDFDict, key: string): string | null {
  const v = dict.get(PDFName.of(key));
  return v ? v.toString().replace(/^\//, "") : null;
}

function numberOf(dict: PDFDict, key: string): number | null {
  const v = dict.get(PDFName.of(key));
  return v instanceof PDFNumber ? v.asNumber() : null;
}

/**
 * How many channels this colour space stores per pixel, or null when we cannot
 * say. `null` is the important return: it is what keeps a CMYK or indexed
 * image from being reinterpreted as RGB and written back as garbage.
 */
type Resolver = { lookup(o: never): unknown };

function channelsFor(dict: PDFDict, doc: Resolver): 1 | 3 | null {
  const raw = dict.get(PDFName.of("ColorSpace"));
  if (!raw) return null;

  const direct = raw.toString().replace(/^\//, "");
  if (direct === "DeviceGray" || direct === "CalGray" || direct === "G") return 1;
  if (direct === "DeviceRGB" || direct === "CalRGB" || direct === "RGB") return 3;

  // ICCBased is an array: [/ICCBased <stream>], and the stream's /N says how
  // many components it has. An ICC profile with N of 1 or 3 behaves as grey or
  // RGB for our purposes; N of 4 is CMYK and is not ours to convert.
  const resolved = doc.lookup(raw as never);
  if (resolved instanceof PDFArray && resolved.size() >= 2) {
    const kind = resolved.get(0)?.toString().replace(/^\//, "");
    if (kind === "ICCBased") {
      const profile = doc.lookup(resolved.get(1) as never);
      const n =
        profile && typeof profile === "object" && "dict" in profile
          ? numberOf((profile as { dict: PDFDict }).dict, "N")
          : null;
      if (n === 1) return 1;
      if (n === 3) return 3;
    }
  }
  return null;
}

/**
 * Decode a Flate-compressed bitmap into plain samples.
 *
 * Returns null whenever anything is unfamiliar — an unexpected filter, a bit
 * depth other than eight, a colour space we do not read, a predictor, or a
 * byte count that does not match the stated geometry. That last check is the
 * one that matters most: if the arithmetic does not come out exactly, we have
 * misunderstood the image, and writing it back would corrupt the document
 * rather than compress it.
 */
export async function decodeRawImage(
  stream: PDFRawStream,
  filters: string[],
  doc: Resolver,
): Promise<RawImage | null> {
  if (filters.length !== 1 || filters[0] !== "FlateDecode") return null;

  const dict = stream.dict;
  if (numberOf(dict, "BitsPerComponent") !== 8) return null;
  if (nameOf(dict, "ImageMask") === "true") return null;

  // A predictor means the rows were transformed before compression (PNG-style
  // filtering). Undoing that correctly is its own job; until it is done, skip.
  if (dict.has(PDFName.of("DecodeParms")) || dict.has(PDFName.of("DP"))) return null;
  // A /Decode array inverts or remaps the samples; honouring it is not worth
  // the risk of getting it backwards.
  if (dict.has(PDFName.of("Decode"))) return null;

  const width = numberOf(dict, "Width");
  const height = numberOf(dict, "Height");
  if (!width || !height || width < 1 || height < 1) return null;

  const channels = channelsFor(dict, doc);
  if (!channels) return null;

  let samples: Uint8Array;
  try {
    samples = await flateDecode(stream.getContents());
  } catch {
    return null;
  }

  // The geometry must account for every byte. Anything else means we have read
  // the image wrongly.
  if (samples.length !== width * height * channels) return null;

  return { samples, width, height, channels };
}
