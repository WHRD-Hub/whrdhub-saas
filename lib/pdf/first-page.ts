/**
 * Render page one of a PDF to an image, for use as a cover.
 *
 * A publication without a cover shows as a grey rectangle in the feed and in
 * the library, which is a poor advertisement for a report somebody spent months
 * writing — and the cover already exists: it is the first page. Nobody should
 * have to export it by hand and upload it separately.
 *
 * pdf.js is loaded on demand, so the ~1 MB renderer only reaches people who are
 * actually publishing something, not every visitor to the feed.
 */

/** Wide enough to stay crisp on a retina card, small enough to be a thumbnail. */
const TARGET_WIDTH = 1000;
const JPEG_QUALITY = 0.82;

export interface FirstPageImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function renderFirstPage(file: Blob): Promise<FirstPageImage | null> {
  try {
    // The legacy build, deliberately. pdf.js 6's default bundle uses very new
    // JavaScript (Map.prototype.getOrInsertComputed among others) and throws on
    // any browser more than a few versions old. Much of this audience is on an
    // older Android phone, and a cover that silently never appears for them is
    // worse than a slightly larger download.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Served from public/ by scripts/copy-pdf-worker.mjs. Deliberately not a
    // bundler-resolved URL: see that script for what went wrong with one.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const data = new Uint8Array(await file.arrayBuffer());
    const task = pdfjs.getDocument({ data });
    const doc = await task.promise;

    try {
      if (doc.numPages < 1) return null;
      const page = await doc.getPage(1);

      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // A PDF page has no background of its own; without this, anything the
      // page leaves untouched renders black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) return null;
      return { blob, width: canvas.width, height: canvas.height };
    } finally {
      // Tear the worker down either way: destroy() lives on the loading task,
      // and leaving it running holds the whole document in memory.
      await task.destroy();
    }
  } catch {
    // A cover is a nicety. A document that will not render still publishes.
    return null;
  }
}
