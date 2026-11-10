/**
 * Builds the royalty-free audio assets the picture would otherwise download:
 * four short UI-style SFX and a warm pad that sits under the narration.
 *
 * Everything is synthesized with ffmpeg-static, so there is no download, no
 * licence and no mismatch between local runs and CI.
 *
 *   node scripts/build-audio-assets.mjs        # fills public/sfx + public/music
 *   --force                                     # overwrite existing files
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SFX_DIR = path.join(ROOT, "public", "sfx");
const MUSIC_DIR = path.join(ROOT, "public", "music");

const FORCE = process.argv.includes("--force");

const run = (args) =>
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", ...args], {
    encoding: "utf8",
    timeout: 120000,
  });

/** 44.1 kHz mono WAV from an aevalsrc expression. */
const renderWav = (file, expr, seconds) =>
  run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${expr}:d=${seconds}:s=44100`,
    "-ar",
    "44100",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    file,
  ]);

const SFX = [
  // Soft rising "boop" for anything appearing in a hand: fast decay.
  { file: "pop.wav", seconds: 0.24, expr: "0.42*sin(2*PI*660*t)*exp(-24*t)+0.30*sin(2*PI*(760+1400*t)*t)*exp(-20*t)" },
  // Airy sweep for scene changes: band-limited pink noise with fades.
  { file: "whoosh.wav", seconds: 0.42, noise: true },
  // Two-part ding for money and payouts: the second ding is delayed with
  // `adelay`, because comas/comparisons inside aevalsrc would need lavfi
  // escaping that fights the filtergraph parser.
  { file: "coin.wav", seconds: 0.36, coin: true },
  // Tiny clock tick: hard attack, 40 ms tail.
  { file: "tick.wav", seconds: 0.10, expr: "0.34*sin(2*PI*2200*t)*exp(-60*t)+0.18*sin(2*PI*1400*t)*exp(-42*t)" },
];

const DING_1 = "0.40*sin(2*PI*1250*t)*exp(-20*t)";
const DING_2 = "0.38*sin(2*PI*1560*t)*exp(-20*t)";

const buildCoin = (file) =>
  run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${DING_1}:d=0.36:s=44100`,
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${DING_2}:d=0.27:s=44100`,
    "-filter_complex",
    "[1:a]adelay=90:all=1[second];[0:a][second]amix=inputs=2:duration=first:normalize=0",
    "-ar",
    "44100",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    file,
  ]);

const buildSfx = () => {
  fs.mkdirSync(SFX_DIR, { recursive: true });
  for (const sfx of SFX) {
    const file = path.join(SFX_DIR, sfx.file);
    if (fs.existsSync(file) && !FORCE) {
      console.log(`skip   ${path.relative(ROOT, file)} (exists)`);
      continue;
    }
    if (sfx.coin) {
      buildCoin(file);
    } else if (sfx.noise) {
      run([
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anoisesrc=color=pink:d=0.42:a=0.9:r=44100",
        "-af",
        "highpass=f=320,lowpass=f=2600,afade=t=in:d=0.10,afade=t=out:st=0.14:d=0.28,volume=0.42",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        file,
      ]);
    } else {
      renderWav(file, sfx.expr, sfx.seconds);
    }
    console.log(`built  ${path.relative(ROOT, file)}`);
  }
};

/**
 * Warm C-major pad, 16s seamless loop. Every LFO frequency is a multiple of
 * 1/16 Hz so the loop point lands exactly on a zero-crossing of every
 * modulation - no click at the loop seam. Low-passed so the voice always wins.
 */
const buildMusicBed = () => {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  const file = path.join(MUSIC_DIR, "bed.mp3");
  if (fs.existsSync(file) && !FORCE) {
    console.log(`skip   ${path.relative(ROOT, file)} (exists)`);
    return;
  }
  const seconds = 16;
  const expr =
    `0.62*(` +
    `0.34*sin(2*PI*130.81*t)` +
    `+0.30*sin(2*PI*261.63*t)*(0.84+0.16*sin(2*PI*(1/${seconds})*t+1.7))` +
    `+0.26*sin(2*PI*329.63*t)*(0.80+0.20*sin(2*PI*(1/${seconds})*t))` +
    `+0.22*sin(2*PI*392.00*t)*(0.75+0.25*sin(2*PI*(3/${seconds})*t+0.9))` +
    `+0.14*sin(2*PI*523.25*t)*(0.70+0.30*sin(2*PI*(5/${seconds})*t+2.2))` +
    `):d=${seconds}:s=44100`;
  run([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${expr}`,
    "-af",
    // No limiter: at this gain the peaks sit far below full scale, and
    // ffmpeg's alimiter auto-levels the bed back up (its `level` option is on
    // by default), which defeats the whole point.
    "highpass=f=70,lowpass=f=1100,lowpass=f=1500,volume=0.24",
    "-ar",
    "44100",
    "-ac",
    "1",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "160k",
    file,
  ]);
  console.log(`built  ${path.relative(ROOT, file)}  (seamless ${seconds}s loop)`);
};

const main = () => {
  if (!fs.existsSync(ffmpeg)) {
    throw new Error("ffmpeg-static not installed (run npm ci)");
  }
  buildSfx();
  buildMusicBed();
};

main();
