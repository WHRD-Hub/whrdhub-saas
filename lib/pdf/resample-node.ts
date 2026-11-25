import sharp, { type JpegOptions, type ResizeOptions } from "sharp";
import type { Resample } from "./shrink.ts";

/**
 * The server's image re-encoder, the Node twin of lib/pdf/resample-browser.ts:
 * decode, scale down to fit, encode as JPEG. Used by scripts that put
 * publications into storage, so a file compressed there matches one compressed
 * in the browser at upload.
 *
 * Whatever goes in, an 8-bit three-channel sRGB JPEG comes out, because that is
 * what lib/pdf/shrink.ts writes into the image's dictionary afterwards.
 */
export const nodeResample: Resample = async (input, { maxEdge, quality }) => {
  const fit = { width: maxEdge, height: maxEdge, fit: "inside" as const, withoutEnlargement: true };
  const jpeg = { quality: Math.round(quality * 100), mozjpeg: true };

  if (input.kind === "jpeg" && (await sharp(input.bytes).metadata()).space === "cmyk") {
    return cmykJpeg(input.bytes, fit, jpeg);
  }

  const image =
    input.kind === "jpeg"
      ? sharp(input.bytes, { failOn: "none" })
      : sharp(input.samples, { raw: { width: input.width, height: input.height, channels: input.channels } });

  const { data, info } = await image
    .resize(fit)
    // A JPEG cannot store transparency, so anything left clear lands on white, as in the browser.
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .jpeg(jpeg)
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3) return null; // shrink.ts declares DeviceRGB; anything else would be mislabelled
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
};

/**
 * A print-ready PDF stores its photographs as CMYK JPEGs, and the libvips
 * decoder hands those back as stored. Files written by Adobe tools (marked with
 * an "Adobe" APP14 segment) store the inks inverted, as browsers and pdf.js
 * assume, so they are flipped back here; letting libvips convert them instead
 * turned every photograph into its negative. The ink-to-screen step is the
 * plain formula, which is what a PDF reader does for DeviceCMYK without a profile.
 */
async function cmykJpeg(
  bytes: Uint8Array,
  fit: ResizeOptions,
  jpeg: JpegOptions,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const inverted = hasAdobeMarker(bytes);
  const { data, info } = await sharp(bytes, { failOn: "none" })
    .pipelineColourspace("cmyk")
    .resize(fit)
    .toColourspace("cmyk")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let p = 0, q = 0; p < data.length; p += info.channels, q += 3) {
    const ink = (j: number) => (inverted ? 255 - data[p + j] : data[p + j]);
    const paper = 255 - ink(3);
    rgb[q] = ((255 - ink(0)) * paper) / 255;
    rgb[q + 1] = ((255 - ink(1)) * paper) / 255;
    rgb[q + 2] = ((255 - ink(2)) * paper) / 255;
  }

  const out = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg(jpeg).toBuffer();
  return { bytes: new Uint8Array(out), width: info.width, height: info.height };
}

/** True when the JPEG carries an Adobe APP14 segment (marker FF EE followed by "Adobe"). */
function hasAdobeMarker(bytes: Uint8Array): boolean {
  // Markers sit in the header, before the image data; there is no need to scan the whole file.
  const end = Math.min(bytes.length - 7, 65536);
  for (let i = 2; i < end; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xee &&
        bytes[i + 4] === 0x41 && bytes[i + 5] === 0x64 && bytes[i + 6] === 0x6f && bytes[i + 7] === 0x62) return true;
  }
  return false;
}
