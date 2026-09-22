# Truck Mods Site

An interactive build page: drag the truck to spin it 360°, click glowing dots
to see what each mod is, jump into close-up "scenes" (engine bay, interior,
undercarriage) for mods you can't see from the spin angle, and link out to
your Instagram.

Pure static HTML/CSS/JS, no build step, no backend. Works on GitHub Pages.

## How it works

- `frames/frame_001.jpg` … `frame_036.jpg` — the 360° spin sequence, one
  image per few degrees, extracted from a video.
- `scenes/*.jpg` — separate close-up photos for angles the spin doesn't
  cover well (engine bay, interior, bed, undercarriage).
- `data/mods.json` — the master mod list (name, brand, link, description).
- `data/hotspots.json` — where each mod's dot sits on each spin frame.
- `data/scenes.json` — the close-up scenes, where their "view" dot sits on
  the spin, and where each mod's dot sits inside the scene image.
- `editor.html` — a local-only tool for clicking to place all those dots
  instead of hand-editing JSON coordinates.

## Order of operations (what I need from you)

**1. Shoot the walk-around video.**
- Phone in landscape, waist-to-chest height, truck roughly centered the
  whole way around.
- Walk one smooth, steady circle around the truck (10–20 seconds), same
  distance throughout. A phone gimbal or just slow careful walking both
  work; the frame extraction below smooths out timing but not shakiness.
- Even, consistent light — overcast day or shade is more forgiving than
  direct sun (no side of the truck should suddenly get blown out or go
  dark as you walk around it).
- Clean, uncluttered background if possible (driveway, empty lot).
- Also grab: 1 photo of the engine bay, 1 of the interior, and any other
  close-ups for mods that won't read from the walk-around distance
  (exhaust tip, skid plates, etc.) — these become "scenes."

**2. Send me the video (and close-up photos).** I'll extract evenly-spaced
frames for you (or you can run `scripts/extract-frames.sh your-video.mov 36`
yourself if you have `ffmpeg` installed — see the script header). Drop the
resulting `frame_001.jpg…frame_036.jpg` into `/frames`, and the close-ups
into `/scenes`.

**3. Send me your mod list.** For each mod: name, brand, category
(Exterior / Performance / Interior / Suspension / etc.), a link (product
page, or the Instagram post where you show it off), and a sentence or two
about it. I'll drop these into `data/mods.json` — or you can edit that file
directly, it's plain JSON with one object per mod.

**4. Place the dots.** Open `editor.html` locally (see "Running locally"
below), pick a mod from the dropdown, drag to the frame where it's clearly
visible, and click on the truck where the mod is. Do that for a handful of
frames per mod (the dot position is interpolated between the frames you
set, so it slides smoothly as you spin — you don't need to click on every
single frame, just enough that the position tracks correctly, e.g. every
3rd–4th frame while that mod is in view). Use "Download hotspots.json" /
"Download scenes.json" when done and replace the files in `/data`.

**5. Give me your Instagram handle/link** for the header button (or edit
`instagram.handle` / `instagram.url` in `data/mods.json` yourself).

You can do all of this yourself since everything is plain files, or hand me
the video/photos/mod list at any point and I'll wire it up.

## Running locally

Any static file server works, e.g. from this folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000` for the site and
`http://localhost:8000/editor.html` for the dot-placement tool. (Opening
`index.html` directly via `file://` won't work — browsers block `fetch()`
of local JSON files from `file://` for security reasons.)

## Deploying (GitHub Pages)

Once pushed to GitHub: repo Settings → Pages → Deploy from branch → pick
this branch and `/ (root)`. The site will be live at
`https://<username>.github.io/<repo>/` with no further setup, since there's
no build step.

## Notes on the interaction model

- The spin is **horizontal only** (one ring of frames at one camera
  height) — dragging left/right rotates through the frame sequence.
  Vertical drag isn't wired up on purpose: a true "drag up/down to change
  elevation" 360 needs a multi-ring dome capture (several passes at
  different heights), which is a lot more shooting for a fairly marginal
  gain here.
- Angles the spin can't show well (engine bay, interior, underneath) are
  handled as separate "scene" photos you click into from a dot on the
  spin, each with its own set of mod dots. This is the standard pattern
  car-configurator sites use and is much easier to shoot solo.
