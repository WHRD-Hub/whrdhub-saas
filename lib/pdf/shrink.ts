import { PDFDocument, PDFName, PDFRawStream, PDFDict, PDFArray, type PDFRef } from "pdf-lib";
import { jpegPayload } from "./filters";
import { decodeRawImage } from "./raw-image";

/**
 * Shrink a PDF by re-encoding the pictures inside it, and nothing else.
 *
 * The obvious way to compress a PDF in a browser is to render each page to a
 * canvas and build a new document out of the results. Do not do that. It turns
 * every page into a photograph: the text stops being text, so the report can no
 * longer be searched, quoted, or read aloud by a screen reader. For a document
 * that exists to be cited, that is not compression, it is destruction.
 *
 * So this works at the object level instead. A PDF is a graph of objects, and
 * the photographs are `/Subtype /Image` streams hanging off each page's
 * resource dictionary. We find those streams, decode them, draw them smaller,
 * re-encode them as JPEG, and put them back. Every other object -- the text,
 * the fonts, the vector artwork, the outline, the metadata -- is passed through
 * untouched, because we never look at it.
 *
 * That is also why this is effective. A 127-page report is not large because of
 * its words; a page of text is a few kilobytes. It is large because its
 * photographs were placed at print resolution and are displayed at a fraction
 * of it.
 *
 * The pixel work is injected as `resample`, because the browser does it with
 * OffscreenCanvas and the test suite does it with a native image library. The
 * graph surgery below is the part worth testing, and this keeps it testable.
 */

/**
 * An image as the PDF stored it: either a JPEG we can hand to a decoder, or
 * plain samples we have to paint ourselves.
 */
export type ResampleInput =
  | { kind: "jpeg"; bytes: Uint8Array }
  | { kind: "raw"; samples: Uint8Array; width: number; height: number; channels: 1 | 3 };

/** Re-encode one image. Returns null to leave the original in place. */
export type Resample = (
  input: ResampleInput,
  opts: { maxEdge: number; quality: number },
) => Promise<{ bytes: Uint8Array; width: number; height: number } | null>;

export interface ShrinkOptions {
  /** Longest edge, in pixels, an image is allowed to keep. */
  maxEdge: number;
  /** JPEG quality, 0..1. */
  quality: number;
  /** Skip images already smaller than this; re-encoding them tends to add bytes. */
  minBytes?: number;
  onProgress?: (done: number, total: number) => void;
}

export interface ShrinkResult {
  bytes: Uint8Array;
  imagesFound: number;
  imagesRewritten: number;
  bytesBefore: number;
  bytesAfter: number;
  /**
   * Why the images we did not rewrite were left alone.
   *
   * Without this, a document that refuses to shrink looks identical to one
   * that is already small, and the only advice we can offer is "split it" —
   * which was wrong the first time it mattered. A count of unreadable images
   * turns a dead end into a sentence somebody can act on.
   */
  skipped: {
    /** Under the size floor: re-encoding these tends to add bytes. */
    tooSmall: number;
    /** A format we decline to guess at: JPEG 2000, CCITT, CMYK, indexed. */
    unsupported: number;
    /** Readable, but the re-encode came out no smaller. */
    noSaving: number;
  };
}

const JPEG = "DCTDecode";

/** Every image XObject in the document, deduplicated by reference. */
function imageRefs(doc: PDFDocument): PDFRef[] {
  const found = new Map<string, PDFRef>();

  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const xobjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
    if (!xobjects) continue;

    for (const key of xobjects.keys()) {
      const ref = xobjects.get(key);
      // Only an indirect reference can be rewritten in place; an inline object
      // belongs to its one page and is rare enough not to chase.
      if (!ref || typeof (ref as PDFRef).tag !== "string") continue;
      const stream = doc.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) continue;
      if (stream.dict.get(PDFName.of("Subtype"))?.toString() !== "/Image") continue;
      found.set((ref as PDFRef).tag, ref as PDFRef);
    }
  }

  return [...found.values()];
}

/** The filter chain, flattened to names. A chain we do not understand is skipped. */
function filtersOf(dict: PDFDict): string[] {
  const f = dict.get(PDFName.of("Filter"));
  if (!f) return [];
  if (f instanceof PDFArray) {
    return f.asArray().map((n) => n.toString().replace(/^\//, ""));
  }
  return [f.toString().replace(/^\//, "")];
}

export async function shrinkPdf(
  input: Uint8Array,
  resample: Resample,
  opts: ShrinkOptions,
): Promise<ShrinkResult> {
  const minBytes = opts.minBytes ?? 24 * 1024;

  // updateMetadata:false -- re-encoding pictures is not authorship, and quietly
  // restamping the producer and modification date of somebody's report is a
  // small lie told about a document we were only asked to make smaller.
  const doc = await PDFDocument.load(input, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  const refs = imageRefs(doc);
  let rewritten = 0;
  let done = 0;
  const skipped = { tooSmall: 0, unsupported: 0, noSaving: 0 };

  for (const ref of refs) {
    opts.onProgress?.(done++, refs.length);

    const stream = doc.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;

    const original = stream.getContents();
    if (original.length < minBytes) {
      skipped.tooSmall++;
      continue;
    }

    const filters = filtersOf(stream.dict);

    // Two shapes are readable. A JPEG, once any transport encoding in front of
    // it is peeled off. And a Flate-compressed bitmap of 8-bit grey or RGB,
    // which is how a document laid out in InDesign or Canva stores its
    // photographs -- skipping those was why a 171 MB photo book compressed to
    // 58 MB and no further.
    //
    // Everything else is still left exactly as it was. Indexed palettes, CMYK,
    // 1-bit scans and JPEG 2000 all require assumptions we cannot check, and a
    // wrong assumption corrupts the picture rather than shrinking it.
    let input: ResampleInput | null = null;
    const jpeg = await jpegPayload(original, filters);
    if (jpeg) {
      input = { kind: "jpeg", bytes: jpeg };
    } else {
      const raw = await decodeRawImage(stream, filters, doc.context);
      if (raw) input = { kind: "raw", ...raw };
    }
    if (!input) {
      skipped.unsupported++;
      continue;
    }

    let replacement: Awaited<ReturnType<Resample>> = null;
    try {
      replacement = await resample(input, { maxEdge: opts.maxEdge, quality: opts.quality });
    } catch {
      replacement = null; // a picture we cannot read is a picture we leave alone
    }
    if (!replacement) {
      skipped.unsupported++;
      continue;
    }

    // Never accept a "compression" that made the file bigger.
    if (replacement.bytes.length >= original.length) {
      skipped.noSaving++;
      continue;
    }

    const next = PDFRawStream.of(stream.dict, replacement.bytes);
    next.dict.set(PDFName.of("Width"), doc.context.obj(replacement.width));
    next.dict.set(PDFName.of("Height"), doc.context.obj(replacement.height));
    next.dict.set(PDFName.of("Filter"), PDFName.of(JPEG));
    next.dict.set(PDFName.of("Length"), doc.context.obj(replacement.bytes.length));

    // The canvas always hands back three-channel 8-bit JPEG, whatever went in.
    // The dictionary has to say so: a greyscale source left describing itself
    // as DeviceGray would be read one byte per pixel and come out as noise.
    next.dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
    next.dict.set(PDFName.of("BitsPerComponent"), doc.context.obj(8));

    // /Decode and /DecodeParms describe the original sample layout. Our
    // re-encode is plain 8-bit, so a stale /Decode would invert the picture,
    // and a stale predictor would have it unpacked as though still filtered.
    next.dict.delete(PDFName.of("Decode"));
    next.dict.delete(PDFName.of("DecodeParms"));
    next.dict.delete(PDFName.of("DP"));

    // /SMask is deliberately left in place. Transparency lives in that separate
    // stream, not in these samples, and the specification scales a soft mask to
    // its image — so re-encoding the picture smaller keeps the mask correct.

    doc.context.assign(ref, next);
    rewritten++;
  }

  opts.onProgress?.(refs.length, refs.length);

  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });

  return {
    bytes,
    imagesFound: refs.length,
    imagesRewritten: rewritten,
    bytesBefore: input.length,
    bytesAfter: bytes.length,
    skipped,
  };
}
