#!/usr/bin/env bash
#
# Shrink a publication until it fits the storage limit, taking as little
# quality as the job needs.
#
#   scripts/compress-pdf.sh report.pdf            # aim for 45 MB
#   scripts/compress-pdf.sh report.pdf 20         # aim for 20 MB
#
# What it does, and does not do:
#
#   Almost every oversized report is oversized because of its photographs,
#   which are usually embedded at print resolution -- 300 dpi or higher -- and
#   then displayed at a fraction of that. Downsampling them to screen
#   resolution is nearly all of the saving and costs nothing anyone will see
#   on a screen.
#
#   Text is left alone. Ghostscript re-encodes images; it does not rasterise
#   the text layer, so the document stays searchable, selectable and
#   accessible to a screen reader afterwards. That matters: a report nobody
#   can search is a report nobody can cite.
#
#   The original is never touched. Output goes to <name>-web.pdf.
#
# Requires ghostscript:  sudo apt install ghostscript  |  brew install ghostscript
set -euo pipefail

SRC="${1:-}"
TARGET_MB="${2:-45}"

if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "usage: $0 <file.pdf> [target-mb]" >&2
  exit 1
fi
command -v gs >/dev/null || { echo "ghostscript (gs) is not installed." >&2; exit 1; }

TARGET=$(( TARGET_MB * 1024 * 1024 ))
OUT="${SRC%.pdf}-web.pdf"
SIZE_OF() { stat -c%s "$1" 2>/dev/null || stat -f%z "$1"; }
MB() { awk -v b="$1" 'BEGIN { printf "%.1f", b/1048576 }'; }

orig=$(SIZE_OF "$SRC")
pages=$(pdfinfo "$SRC" 2>/dev/null | awk '/^Pages/{print $2}' || echo "?")
echo "original: $(MB "$orig") MB, $pages pages"
echo "target:   ${TARGET_MB} MB"
echo

if [ "$orig" -le "$TARGET" ]; then
  echo "Already within the target. Nothing to do."
  exit 0
fi

# Ordered from gentlest to most aggressive. The first one that fits wins, so a
# document is never degraded further than it has to be.
#          label            dpi   jpeg-quality
ATTEMPTS=("print quality    :200:0.9"
          "high screen      :150:0.85"
          "screen           :120:0.8"
          "compact          :96:0.7"
          "smallest         :72:0.6")

for attempt in "${ATTEMPTS[@]}"; do
  label="${attempt%%:*}"; rest="${attempt#*:}"
  dpi="${rest%%:*}"; q="${rest##*:}"

  gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.7 \
     -dNOPAUSE -dQUIET -dBATCH -dSAFER \
     -dDetectDuplicateImages=true \
     -dColorImageDownsampleThreshold=1.0 -dGrayImageDownsampleThreshold=1.0 \
     -dDownsampleColorImages=true  -dColorImageResolution="$dpi"  -dColorImageDownsampleType=/Bicubic \
     -dDownsampleGrayImages=true   -dGrayImageResolution="$dpi"   -dGrayImageDownsampleType=/Bicubic \
     -dDownsampleMonoImages=true   -dMonoImageResolution=$(( dpi * 2 )) \
     -dAutoFilterColorImages=false -dColorImageFilter=/DCTEncode \
     -dAutoFilterGrayImages=false  -dGrayImageFilter=/DCTEncode \
     -dJPEGQ=$(awk -v q="$q" 'BEGIN { printf "%d", q*100 }') \
     -sOutputFile="$OUT" "$SRC" 2>/dev/null

  new=$(SIZE_OF "$OUT")
  pct=$(awk -v n="$new" -v o="$orig" 'BEGIN { printf "%.0f", n/o*100 }')
  printf "  %s %4s dpi -> %8s MB  (%s%% of original)" "$label" "$dpi" "$(MB "$new")" "$pct"

  if [ "$new" -le "$TARGET" ]; then
    echo "  <- fits"
    out_pages=$(pdfinfo "$OUT" 2>/dev/null | awk '/^Pages/{print $2}' || echo "?")
    echo
    if [ "$out_pages" != "$pages" ]; then
      echo "WARNING: page count changed ($pages -> $out_pages). Check the output before publishing." >&2
      exit 1
    fi
    echo "Wrote $OUT  --  $(MB "$new") MB, $out_pages pages, text layer intact."
    echo "Open it and check a photo-heavy page before you upload."
    exit 0
  fi
  echo
done

echo
echo "Even the most aggressive setting leaves this above ${TARGET_MB} MB."
echo "That usually means the size is not coming from photographs. Check with:"
echo "    pdfimages -list \"$SRC\" | head"
echo "If there are few images, the document is probably a scan -- every page is"
echo "one large picture -- and it is better split into volumes than crushed."
exit 1
