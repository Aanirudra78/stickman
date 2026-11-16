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

## Voiceover

Narration is generated with ElevenLabs under its commercial license for the
project's own account (not committed as CC0; regenerated per script change).
