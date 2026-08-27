import { shrinkPdf } from "./shrink";
import { browserResample } from "./resample-browser";

/**
 * Shrink a PDF in the browser, taking as little quality as the job needs.
 *
 * Passes run from gentlest to most aggressive and stop at the first that fits,
 * so a document that only just exceeds the limit is barely touched, while one
 * that is wildly over gets compressed properly. Nothing here is destructive to
 * text: see lib/pdf/shrink.ts for why that matters and how it is achieved.
 */

export interface Pass {
  label: string;
  maxEdge: number;
  quality: number;
}

/**
 * 1800px is roughly 150 dpi across an A4 page — the point where a photograph
 * still looks right on a laptop screen and prints acceptably. 900px is screen
 * only, and is a last resort before giving up.
 */
export const PASSES: Pass[] = [
  { label: "high quality", maxEdge: 2000, quality: 0.82 },
  { label: "good quality", maxEdge: 1600, quality: 0.75 },
  { label: "screen quality", maxEdge: 1200, quality: 0.7 },
  { label: "compact", maxEdge: 900, quality: 0.62 },
];

export interface CompressProgress {
  pass: Pass;
  passIndex: number;
  passCount: number;
  imagesDone: number;
  imagesTotal: number;
}

export interface CompressOutcome {
  file: File;
  bytesBefore: number;
  bytesAfter: number;
  pass: Pass;
  imagesRewritten: number;
  /** False when even the most aggressive pass could not reach the target. */
  fits: boolean;
}

/**
 * One pass over the document.
 *
 * This deliberately does not use a Web Worker. Turbopack emits a worker
 * referenced by `new URL(..., import.meta.url)` as a raw asset rather than a
 * compiled bundle, so the browser would be handed TypeScript with bare imports
 * and fail on the first upload. Running here is also honest about where the
 * cost is: `createImageBitmap` and `convertToBlob` do the decoding and encoding
 * off the main thread already, and `browserResample` yields between images so
 * the page keeps painting.
 */
async function runPass(
  buffer: ArrayBuffer,
  pass: Pass,
  onImages: (done: number, total: number) => void,
) {
  // A copy per pass: a pass that does not shrink the file enough has to be able
  // to start again from the original bytes.
  return shrinkPdf(new Uint8Array(buffer.slice(0)), browserResample, {
    maxEdge: pass.maxEdge,
    quality: pass.quality,
    onProgress: onImages,
  });
}

export async function compressPdfToFit(
  file: File,
  targetBytes: number,
  onProgress?: (p: CompressProgress) => void,
): Promise<CompressOutcome> {
  const buffer = await file.arrayBuffer();
  let best: { bytes: Uint8Array; pass: Pass; rewritten: number } | null = null;

  for (let i = 0; i < PASSES.length; i++) {
    const pass = PASSES[i];
    const result = await runPass(buffer, pass, (done, total) =>
      onProgress?.({
        pass,
        passIndex: i,
        passCount: PASSES.length,
        imagesDone: done,
        imagesTotal: total,
      }),
    );

    best = { bytes: result.bytes, pass, rewritten: result.imagesRewritten };
    if (result.bytesAfter <= targetBytes) break;

    // No images were rewritten, so a harsher pass would change nothing either:
    // the weight is not coming from photographs. Stop rather than burn the
    // person's battery proving it three more times.
    if (result.imagesRewritten === 0) break;
  }

  if (!best) throw new Error("Compression produced nothing.");

  const out = new File([best.bytes as BlobPart], file.name, {
    type: "application/pdf",
    lastModified: file.lastModified,
  });

  return {
    file: out,
    bytesBefore: file.size,
    bytesAfter: out.size,
    pass: best.pass,
    imagesRewritten: best.rewritten,
    fits: out.size <= targetBytes,
  };
}
