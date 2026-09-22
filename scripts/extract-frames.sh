#!/usr/bin/env bash
# Extracts evenly-spaced frames from a 360 walk-around video into /frames
# as frame_001.jpg ... frame_NNN.jpg, ready for the spin viewer.
#
# Usage:
#   scripts/extract-frames.sh path/to/video.mov 36
#
# Requires ffmpeg (https://ffmpeg.org). On most systems: `brew install ffmpeg`
# or `apt install ffmpeg`.

set -euo pipefail

VIDEO="${1:?Usage: extract-frames.sh <video-file> [frame-count]}"
COUNT="${2:-36}"
OUT_DIR="$(dirname "$0")/../frames"

mkdir -p "$OUT_DIR"

DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO")
FPS=$(python3 -c "print($COUNT / $DURATION)")

echo "Video duration: ${DURATION}s -> extracting $COUNT frames (~${FPS} fps sample rate)"

ffmpeg -y -i "$VIDEO" -vf "fps=$FPS,scale=1600:-1" -q:v 2 \
  "$OUT_DIR/frame_%03d.jpg"

# Trim/pad to exactly COUNT frames if ffmpeg produced a slightly different amount.
ACTUAL=$(ls "$OUT_DIR"/frame_*.jpg | wc -l | tr -d ' ')
echo "Extracted $ACTUAL frames into $OUT_DIR"
if [ "$ACTUAL" -ne "$COUNT" ]; then
  echo "Note: got $ACTUAL frames instead of $COUNT. Update data/hotspots.json 'totalFrames' to match,"
  echo "or re-run with a slightly different frame count / trim the source video to one clean loop first."
fi
