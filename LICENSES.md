# Asset licenses

Everything shipped in this film's audio (and all code/visuals) is either
original or royalty-free. No attribution is required for anything below, but
this file documents where each asset came from.

## Sound effects (`public/sfx/`)

Since Phase 2 the SFX are real recordings from Kenney's CC0 packs:

| File       | Source pack                | Sample                    |
| ---------- | -------------------------- | ------------------------- |
| `pop.wav`  | Kenney "Interface Sounds"  | `drop_001.ogg`            |
| `coin.wav` | Kenney "Casino Audio"      | `chips-stack-1.ogg`       |
| `tick.wav` | Kenney "Interface Sounds"  | `tick_001.ogg`            |
| `ding.wav` | Kenney "Interface Sounds"  | `confirmation_001.ogg`    |
| `thud.wav` | Kenney "Impact Sounds"     | `impactSoft_heavy_000.ogg`|
| `whoosh.wav` | synthesized in-repo (see below) | —               |

- Packs: https://kenney.nl/assets/interface-sounds ,
  https://kenney.nl/assets/casino-audio , https://kenney.nl/assets/impact-sounds
- License: **CC0 1.0** (creativecommons.org/publicdomain/zero/1.0) — Kenney
  states the assets are "free to use commercially and non-commercially, no
  attribution needed".

## Music bed (`public/music/bed.mp3`)

- **"Calm Piano 1 (Vaporware)"** by Vaporware —
  https://opengameart.org/content/calm-piano-1-vaporware
- License: **CC0 1.0** (as published on OpenGameArt).
- Used here as a 55s excerpt, high-pass filtered and level-matched to duck
  under the narration (`src/audio/MusicBed.tsx`).

## Synthesized fallbacks

`scripts/build-audio-assets.mjs` can regenerate every SFX slot (including the
original synthesized `whoosh`) and a seamless pad bed as a safety net for fresh
checkouts. It **never overwrites committed files** unless `--force` is passed.
Synth content is generated with ffmpeg-static (`aevalsrc`/`anoisesrc`), so it is
royalty-free by construction.

## Background plates (`public/env/plates/`)

Since Phase 3 the environment backdrops are AI-generated illustrations
(flat pastel storybook style, one plate per world). Phase 5A expanded the
library to 22 worlds: study, office, dusk-city, park, dream-night,
neon-street, skyline-night, metro-platform, office-night, rooftop-dawn,
hilltop-dawn, riverbank, forest-path, garden-bench, starlit-field, library,
cafe, rain-window, classroom, bedroom-desk, kitchen-table, workshop. They were
generated with the Recraft flash image model via OpenRouter's free tier, from
hand-written prompts in this repo's session history — no third-party artwork
was copied or used as source. Generated images carry no third-party rights
claims; they are treated as original project assets. Pixel-probed for the
caption-band lightness contract (`out/probe-plates.ps1`).

## Voiceover

Narration is generated with Microsoft Edge TTS (free, no account, no credits)
by default; ElevenLabs remains available in the studio for manual use under
its commercial license. Neither voice set is committed as CC0; it is
regenerated per script change.
