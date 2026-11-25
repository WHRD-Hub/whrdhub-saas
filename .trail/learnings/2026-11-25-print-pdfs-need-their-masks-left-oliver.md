---
title: Print PDFs need their masks left alone and their Adobe CMYK photos inverted when compressed
author: Oliver
date: 2026-11-25
branch: feat/permanent-file-links
cost: { minutes: 62, tokens: 341193 }
id: l-5aaecc8d
scope: repo
status: active
src: agent
touches:
  - lib/pdf/passes.ts
  - lib/pdf/compress-client.ts
  - lib/pdf/resample-node.ts
  - lib/pdf/first-page-node.ts
  - lib/pdf/shrink.ts
  - scripts/file-links.mjs
  - data/file-links.md
---

## Decided
- Never re-encode an image that is another image's soft mask or stencil. Some layout tools also list masks as ordinary page images; turned into three-channel JPEG, the reader cannot decode them and the masked picture vanishes. This applies to the browser upload compressor too.
- On the server, a CMYK JPEG carrying an Adobe APP14 marker stores its inks inverted, as browsers and pdf.js assume. Invert the samples, then convert with the plain CMYK formula.
- Restoring print originals compresses them with the same passes as the upload form (`--compress <MB>`), and draws a missing cover from page one (`--covers`), in the format the recorded cover address ends in.

## Tried and ruled out
- Letting libvips convert CMYK to sRGB: libvips does not undo the Adobe inversion, so every photograph came out as its negative.
- Negating after conversion to RGB: close, but colours shift (cyan cast, pink turns blue). The inversion has to happen on the CMYK samples.

## Watch out
- The 2024-2025 photo book (171 MB original) only reaches 19.8 MB at the most compact pass, against 10.9 MB for the copy the site had before. Most of its weight is 111 CMYK photographs.
- Drawing a cover for an existing cover would download the whole document, so the script checks storage first.
- The browser path's handling of Adobe CMYK JPEGs has not been checked against a real upload.

In the code:
- lib/pdf/shrink.ts: imageRefs skips images referenced by /SMask or /Mask.
- lib/pdf/resample-node.ts: nodeResample and cmykJpeg; lib/pdf/first-page-node.ts: renderFirstPageNode.
- lib/pdf/passes.ts: PASSES shared by lib/pdf/compress-client.ts and scripts/file-links.mjs.
- scripts/file-links.mjs restore --compress 15 --covers; data/file-links.md documents it.
