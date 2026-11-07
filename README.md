# Stickman Explainer (Remotion)

1080x1920 / 30 fps / frame-driven stickman explainer on a light, animated
backdrop, with a natural male English voiceover. The video is generated from
`public/script.json` — edit that file, not the components.

## Studio (paste a script, get a video)

```bash
npm run creator        # -> http://localhost:4321 (also on your phone, same WiFi)
```

Paste a script, hit **Auto-split**, edit the scene cards, pick a voice and
**Render**. The server runs the same pipeline as CI (script → voiceover →
Remotion → compress) and shows live progress over SSE. Renders land in
`studio/jobs/<id>/video.mp4` and stay in the History list.

- `Draft` = 540×960 (fast check), `Final` = 1080×1920.
- Voice: ElevenLabs (needs `ELEVENLABS_API_KEY`) or Microsoft Edge (free).
  Both providers produce word timings, so lip sync works either way.
- Settings dialog stores the key in `.env` and shows a QR code for the phone.
  Set `STUDIO_PIN` to require a PIN on LAN access.

## Render from the phone (PC off)

The project is public at <https://github.com/Aanirudra78/stickman>; the phone
page runs at <https://aanirudra78.github.io/stickman-studio/>. One button
dispatches the **Render video** workflow, polls it, then plays and downloads the
MP4 from the release asset (fine-grained token: Actions read/write + Contents
read). The repo is public because release assets cannot be fetched cross-origin
(`cloud/index.html` therefore links the direct asset URL instead of fetching a
blob). Setup and tradeoffs: [`docs/RENDER-IN-CLOUD.md`](docs/RENDER-IN-CLOUD.md).

## Commands

```bash
npm install
npm run creator        # local Studio app (script -> video)
npm run publish:cloud  # republish the phone page to GitHub Pages
npm run dev            # Remotion Studio (preview)
npm run voiceover      # generate/refresh narration from script.json
npm run voiceover -- --force   # rebuild every clip
npm run render         # out/stickman-test.mp4
npm run render:video   # out/video.mp4 (what the cloud workflow renders)
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
| `shared/detect.mjs` | Script understanding: verb -> action, noun -> prop, name -> guest | Yes |
| `src/actions/library.ts` | 61 hand-authored action clips | Yes |
| `src/props/Props.tsx` | 22 prop drawings | Yes |

Adding a scene: append an object to `public/script.json`, run
`npm run voiceover`, done. Nothing else is required — the composition duration
is derived from the script plus the measured narration.

## Script format

```jsonc
{
  "voice": "nPczCjzI2devNBz1zQrb", // ElevenLabs id, or an Edge "…Neural" name
  "tts": {
    "provider": "elevenlabs",       // "elevenlabs" | "edge"
    "heavy": true                   // deep-narrator EQ + compressor
  },
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
      ],
      "actions": [                      // optional; auto-detected when omitted
        { "at": 2.3, "id": "invest" }   // seconds from the scene start
      ],
      "props": ["money", "phone"],      // optional; max 2, auto-detected too
      "guest": {                        // optional cameo on a mentioned name
        "name": "Rahul",
        "at": 0.9,                      // when the guest walks in
        "enter": "walk"                 // "walk" | "jump" | "magic"
      }
    }
  ]
}
```

## Acting, props and guests (auto-detected)

Every pasted script is run through `shared/detect.mjs` by `studio/split.mjs`,
so the Studio, the CLI and the GitHub Actions render all produce the same
acting. You can still hand-edit the fields, or drop a chip in the Studio.

- **Actions** — 61 clips (`src/actions/library.ts`): run, walk, jump, dance,
  fight, sit, give, throw, type, count, invest, cry, laugh, facepalm, ... The
  clip is layered over the pose, so `talking` keeps breathing while the arms
  act. A scene always gets at least one action (3-level fallback: verb -> line
  shape -> a safe gesture), so the character is never frozen.
- **Props** — 22 drawings (`money`, `phone`, `laptop`, `chart_up`, `house`,
  `clock`, `warning`, ...). Amounts like "50,000" imply money even when the
  script never says "paisa".
- **Guests** — when a person's name is mentioned, a second stickman walks,
  jumps or pops in, shows a **name tag**, and leaves at the end of the scene.
  The main character slides left to make room. Only names count (a Hindi
  postposition or a repeated capitalised name); sentence-opening nouns like
  "Mehnat karo" are ignored. There is no permanent duo.
- The title scene is always still and prop-free.

Run the detector contract checks with `npm run test:detect`.

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
2. synthesizes each `voiceover` through `scripts/tts/` — either **ElevenLabs**
   (default: `eleven_multilingual_v2`, `with-timestamps` for word-level timing)
   or **Microsoft Edge** (`@andresaya/edge-tts`, free, no key). Provider is
   `tts.provider`, or auto: ElevenLabs when `ELEVENLABS_API_KEY` is set,
   otherwise Edge. Voice ids are validated per provider so an Edge name can
   never be sent to ElevenLabs (and vice versa),
3. applies the **heavy narrator chain** in one ffmpeg pass when
   `tts.heavy` is on (`HEAVY_CHAIN` in `scripts/audio.mjs`): highpass 70 Hz →
   lowshelf +2 dB @180 Hz → +1.5 dB @3 kHz → compressor → limiter −3 dBFS,
   plus peak normalization to **−3 dBFS**. Filters only touch amplitude, so
   word timings never shift,
4. writes `public/voice/scene-NN.mp3` and `src/voice/manifest.json`
   (durations, per-word timings, gain applied).

Results are cached by a hash of `provider + voice + settings + text + chain`, so
re-running only pays for lines that changed. Voice Library voices (Ron Sage,
Hagen, Atlas, Don) require a paid ElevenLabs plan; the free plan can only use
premade voices (default: Brian - Deep, Resonant & Comforting).

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
