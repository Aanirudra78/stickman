# Stickman Explainer (Remotion)

1080x1920 / 30 fps / frame-driven stickman explainer on a light, animated
backdrop, with a natural male English voiceover. The video is generated from
`public/script.json` — edit that file, not the components.

## Commands

```bash
npm install
npm run dev            # Remotion Studio (preview)
npm run voiceover      # generate/refresh narration from script.json
npm run voiceover -- --force   # rebuild every clip
npm run render         # out/stickman-test.mp4
npx remotion still StickmanExplainer out/frame.png --frame=90
```

## Architecture (editable boundaries)

| Path | Owns | Safe to change? |
| --- | --- | --- |
| `public/script.json` | Scenes, text, poses, durations, narration | Yes — main input |
| `src/poses/poses.ts` | Pose library (joint angles + face params) | Yes |
| `src/scenes/TextScene.tsx` | "text" scene template | Yes |
| `src/scenes/PointsScene.tsx` | "points" scene template | Yes |
| `src/scenes/SceneFrame.tsx` | Scene enter/exit fade + rise + push-in | Yes |
| `src/video/Background.tsx` | Animated backdrop (colour fields, grid, rings, numeral, grain) | Yes — keep it light |
| `src/video/PoseFx.tsx` | Accent burst behind the head on excited poses | Yes |
| `src/video/Overlays.tsx` | Wordmark chip, chapter counter, segmented progress bar | Yes |
| `src/video/StickmanVideo.tsx` | Timeline driver (scene, pose, placement, mouth, blink, audio) | Yes, but changes affect everything |
| `src/rig/skeleton.ts` | Joint solver (angles -> points) | **No** — rig |
| `src/rig/Stickman.tsx` | Rig SVG painting (bones + face) | **No** — rig |

Adding a scene: append an object to `public/script.json`, run
`npm run voiceover`, done. Nothing else is required — the composition duration
is derived from the script plus the measured narration.

## Script format

```jsonc
{
  "voice": "en-US-AndrewMultilingualNeural", // optional Edge TTS voice
  "scenes": [
    {
      "text": "Headline",              // "\n" = line break
      "voiceover": "What to say",       // optional narration -> run `npm run voiceover`
      "pose": "idle",                   // idle|talking|pointing|thinking|surprised|happy
      "scene_type": "text",             // "text" | "points"
      "duration": 2,                    // seconds — MINIMUM, grows to fit narration
      "speaking": false,                // optional, default: pose === "talking"
      "items": ["only for points"],     // required when scene_type = "points"
      "pose_changes": [                 // optional mid-scene pose flip
        { "at": 1.1, "pose": "surprised" }
      ]
    }
  ]
}
```

## Timing with voiceover

- `duration` is a floor. The real length of a scene is
  `last spoken word + 0.45s` (`VOICE_TAIL_SECONDS`), so the text stays on
  screen for the whole line and a beat longer.
- We size from the last **word**, not the clip length: the TTS clips carry
  ~0.8s of trailing silence that is deliberately cut. The `<Audio>` sits inside
  the scene `<Sequence>`, so it is trimmed at the scene boundary.
- The mouth flaps **only while a word is being spoken** (word timings come from
  the TTS response), so pauses close the mouth instead of flapping at silence.
  Scenes without narration fall back to the `speaking` flag.
- **Points items are timed to the voice.** Each item's first word is matched
  against the narration (`getItemReveals` in `src/voice/voiceover.ts`); the
  bullet appears and the pose changes on that word. Items that cannot be matched
  fall back to a fixed stagger. Points scenes without explicit `pose_changes`
  automatically cycle `pointing → thinking → talking`, one pose per item.
- `assertVoiceoverMatchesScript()` fails the render if the audio was not
  regenerated after editing a `voiceover` line.

## Voiceover generation

`scripts/generate-voiceover.mjs`:

1. reads `public/script.json`,
2. synthesizes each `voiceover` with Microsoft Edge neural TTS
   (`@andresaya/edge-tts`, free, no API key). The default is
   `en-US-AndrewMultilingualNeural` at `rate: "-4%"` — a natural male read
   (~180 wpm) instead of a rushed reel voice,
3. peak-normalizes each clip to **-3 dBFS** with ffmpeg (`volume` filter only,
   so word timings never shift),
4. writes `public/voice/scene-NN.mp3` and `src/voice/manifest.json`
   (durations, per-word timings, gain applied).

Results are cached by a hash of `text + voice + rate + normalization`, so
re-running only pays for lines that changed.

## Motion rules

- Every value comes from `useCurrentFrame()`; no CSS transitions/animations.
- Pose changes blend over 8 frames (`interpolate` + `Easing`), and
  `pointing` / `surprised` / `happy` add a `spring()` overshoot (~5%).
- Breathing bob + blinking run on every frame, so the character is never frozen.
- Talking is a deterministic mouth toggle, gated by the narration word timings.
- Acting beats are layered on the blended pose: a slow weight shift
  (`getBodySway`), a small head/arm lilt on spoken words (`getSpeechLilt`) and
  deterministic eye darts every ~1.35 s (`getGazeSaccade`). Raised V arms opt
  out of the arm lilt so the pose stays solid.
- Text scenes sit at `y=1601 / scale=1.24`; points scenes at `y=1541 /
  scale=1.62` (`STAGE_LAYOUTS` in `src/timeline/timeline.ts`). The hip height is
  chosen so the feet land on the same floor line (~1800 px) in both templates,
  while the bigger body still starts below the `y=1150` text band.
- The face is drawn chunky on purpose (wide eyes, thick mouth, crisp O mouth and
  smile arc) so it still reads when the character is small. The open "O" stops
  above the chin/neck ink (~27.5 of the head's 36.5 inner radius) so surprise
  never reads as a blob hanging off the chin.
- Arms-up poses form a V: the upper arms swing **outside** the head silhouette
  and the forearms point up, so nothing curls over the head.

## Look

- Light theme with depth, not a flat fill: `src/video/Background.tsx` layers a
  warm/cool base wash, three drifting colour fields, a parallax dot grid, two
  faint orbit rings, a ghost chapter numeral, deterministic film grain and a
  soft vignette. Everything is a pure function of the frame.
- Decor stays above `lum 170` on purpose (`BACKDROP` in `src/config.ts`), so the
  pixel probes can still treat only real content as ink.
- Character ink is near-black with a soft drop shadow, so it separates from the
  backdrop. `surprised` / `happy` add a low-alpha accent burst behind the head
  (`src/video/PoseFx.tsx`) that tracks the head as the pose blends.
- Editorial typography: the first headline line is ink, a following payoff line
  is accent, and both auto-fit the safe column (`src/scenes/fitText.ts`). Words
  spring in with a small stagger; a short accent rule opens the block and a
  hairline + diamond closes it. A faint orbit ring sits behind the statement.
- Points scenes get a rounded `KEY POINTS` pill, an auto-fit heading that wipes
  in, numbered ink badges with a one-shot ring, rows that spring up and dividers
  that draw left-to-right.
- Scene transitions add a restrained push-in, lift and blur on top of the fade
  (`src/scenes/SceneFrame.tsx`), so cuts feel like one camera move.
- Persistent furniture (`src/video/Overlays.tsx`): a frosted wordmark chip
  top-left, a `03 / 05` chapter counter top-right, and a segmented progress bar
  at the bottom where each segment is one scene and fills with its own progress.

## Fonts

Self-hosted in `public/fonts` and loaded with `@remotion/fonts`:
Inter (Latin, used by the current English script) + Noto Sans Devanagari (kept
for Hindi/Hinglish, with correct conjuncts/matras).
`assertFontsLoaded()` fails the render instead of silently falling back.

## Checks

```bash
npm run typecheck

# rig geometry / pose library
npx tsc scripts/check-poses.ts --outDir .tmp-check --module commonjs \
  --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node .tmp-check/scripts/check-poses.js

# pose blend curve + spring overshoot
npx tsc scripts/check-pose-blend.ts --outDir .tmp-check --module commonjs \
  --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
node .tmp-check/scripts/check-pose-blend.js

# narration vs timeline (window fits speech, text matches manifest,
# one readable pose per points item)
npx tsc scripts/check-voice-timing.ts --outDir .tmp-check --module commonjs \
  --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck \
  --resolveJsonModule
node .tmp-check/scripts/check-voice-timing.js

# audio really is in the rendered MP4, per scene
node scripts/check-rendered-audio.mjs

# quiet frames: silent + blink-open + settled pose (input for the face probe)
npx tsc scripts/find-quiet-frames.ts --outDir .tmp-check --module commonjs \
  --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck \
  --resolveJsonModule
node .tmp-check/scripts/find-quiet-frames.js

# stills for the pixel probes (exact frame times, no +0.001 nudge)
$ff = "node_modules\@remotion\compositor-win32-x64-msvc\ffmpeg.exe"
foreach ($f in 32,127,152,226,274,328,419,505,640) {
  & $ff -y -v error -ss ([math]::Round($f / 30.0, 5)) -i out/stickman-test.mp4 `
    -frames:v 1 "out/qa/f$f.png"
}

# safe margins, white background, text/character overlap, readable size
powershell -ExecutionPolicy Bypass -File scripts/probe-stills.ps1

# face shapes at head-local scale: flat smile / wide smile + arcs / tall O
powershell -ExecutionPolicy Bypass -File scripts/probe-face.ps1
```

The face probe measures what a viewer sees at 1.24x–1.62x, in head-local px:
`idle` 44.4 x 6.5 (flat line), `pointing` 44.4 x 6.8 (readable curve), `happy`
46.8 x 6.5 with `^ ^` eyes, and `surprised` 14.8 x 24.7 (a tall O) with 20
px-tall eyes. It also checks that the O keeps a ≥10 px clear gap above the chin
and that the fill below the mouth is near-white (≥95%), because the failure it
was written for was the O merging into the chin line. Both probes fail the run:
`Check` takes the boolean as its own argument, and the mouth span grows from the
row it actually detected rather than from the guessed mouth centre.

The stills probe's corner-luminance floor is `240` (top) / `225` (bottom)
instead of flat-white `255`, because the new backdrop adds a deliberate light
vignette. The decor itself never drops near the ink threshold.
