import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";

/**
 * Render page one of a PDF as a cover image, on the server. The Node twin of
 * lib/pdf/first-page.ts, which does the same in the browser when a publication
 * is uploaded without a cover: same width, same white background.
 *
 * `format` follows the extension of the address the cover must live at, because
 * a recorded address cannot change (see data/file-links.md).
 */
const TARGET_WIDTH = 1000;
const JPEG_QUALITY = 82;

export async function renderFirstPageNode(
  pdf: Uint8Array,
  format: "png" | "jpeg" | "webp",
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Fonts a PDF names but does not embed are drawn from pdf.js's own set.
  const root = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const standardFontDataUrl = pathToFileURL(join(root, "standard_fonts") + "/").href;

  const task = pdfjs.getDocument({ data: pdf, standardFontDataUrl });
  const doc = await task.promise;
  try {
    if (doc.numPages < 1) throw new Error("The PDF has no pages.");
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    // A PDF page has no background of its own; without this, anything the page leaves untouched renders black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const png = await canvas.encode("png");
    const out = sharp(png);
    const bytes =
      format === "png" ? await out.png({ compressionLevel: 9 }).toBuffer()
      : format === "webp" ? await out.webp({ quality: JPEG_QUALITY }).toBuffer()
      : await out.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(bytes), width: canvas.width, height: canvas.height };
  } finally {
    await task.destroy();
  }
}
