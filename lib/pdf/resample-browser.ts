import type { Resample } from "./shrink";

/**
 * The browser's image re-encoder: decode, draw smaller, encode as JPEG.
 *
 * Both `createImageBitmap` and `OffscreenCanvas` hand the actual decoding and
 * encoding to the browser, off the main thread, so this stays cheap even for a
 * hundred print-resolution photographs. Neither needs a library.
 */
export const browserResample: Resample = async (bytes, { maxEdge, quality }) => {
  // Hand the main thread back before each image so the progress bar paints and
  // the tab stays responsive. The decode and the encode below are asynchronous
  // and the browser performs them off the main thread; this loop is not the
  // thing that would freeze the page, but a hundred iterations without a break
  // still starves rendering.
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Copy into a fresh buffer: the view we are handed points into the PDF's own
  // memory, and Blob would otherwise capture far more than this one image.
  const blob = new Blob([bytes.slice() as unknown as BlobPart], { type: "image/jpeg" });

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null; // a picture the browser cannot decode is one we leave alone
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxEdge / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close(); // release the decoded frame before the next image is read

  const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { bytes: new Uint8Array(await out.arrayBuffer()), width: w, height: h };
};
