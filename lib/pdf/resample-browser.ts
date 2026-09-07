import type { Resample } from "./shrink";

/**
 * The browser's image re-encoder: decode, draw smaller, encode as JPEG.
 *
 * Two kinds of input arrive here. A `jpeg` is handed straight to
 * `createImageBitmap`, which decodes it off the main thread. A `raw` image is
 * one the PDF stored as plain samples — Flate-compressed grey or RGB, which is
 * how a document laid out in InDesign or Canva usually stores its photographs
 * — and those are painted through ImageData instead. Both end as a JPEG.
 *
 * Neither path needs a library, and both do the expensive work in the browser
 * rather than in JavaScript.
 */
export const browserResample: Resample = async (input, { maxEdge, quality }) => {
  // Hand the main thread back before each image so the progress bar paints and
  // the tab stays responsive. The decode and encode below are asynchronous and
  // performed off the main thread; this loop is not what would freeze the page,
  // but a hundred iterations without a break still starves rendering.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const source = input.kind === "jpeg" ? await fromJpeg(input.bytes) : fromRaw(input);
  const bitmap = await source;
  if (!bitmap) return null;

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxEdge / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) bitmap.close();
    return null;
  }

  // A JPEG cannot store transparency, so anything the source leaves clear must
  // land on white rather than on black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { bytes: new Uint8Array(await out.arrayBuffer()), width: w, height: h };
};

async function fromJpeg(bytes: Uint8Array): Promise<ImageBitmap | null> {
  // Copy into a fresh buffer: the view we are handed points into the PDF's own
  // memory, and Blob would otherwise capture far more than this one image.
  const blob = new Blob([bytes.slice() as unknown as BlobPart], { type: "image/jpeg" });
  try {
    return await createImageBitmap(blob);
  } catch {
    return null; // a picture the browser cannot decode is one we leave alone
  }
}

/**
 * Paint raw samples onto a canvas.
 *
 * ImageData wants four channels; the PDF gives one or three. Expanding is a
 * straight copy with alpha forced opaque, which is correct here: transparency
 * in a PDF lives in a separate soft-mask stream, never in these samples.
 */
async function fromRaw(input: {
  samples: Uint8Array;
  width: number;
  height: number;
  channels: 1 | 3;
}): Promise<ImageBitmap | null> {
  const { samples, width, height, channels } = input;
  try {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, p = 0; p < rgba.length; p += 4) {
      if (channels === 1) {
        const v = samples[i++];
        rgba[p] = v;
        rgba[p + 1] = v;
        rgba[p + 2] = v;
      } else {
        rgba[p] = samples[i++];
        rgba[p + 1] = samples[i++];
        rgba[p + 2] = samples[i++];
      }
      rgba[p + 3] = 255;
    }
    return await createImageBitmap(new ImageData(rgba, width, height));
  } catch {
    return null;
  }
}
