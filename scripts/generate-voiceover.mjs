/**
 * Generates the voiceover for `public/script.json`.
 *
 *   npm run voiceover            # only synthesize new/changed lines
 *   npm run voiceover -- --force # re-synthesize everything
 *
 * Provider: Microsoft Edge neural TTS via `@andresaya/edge-tts`
 * (free, no API key, real neural voices + word-level timings).
 *
 * Outputs:
 *   public/voice/scene-01.mp3 ...   played by <Audio> in the composition
 *   src/voice/manifest.json         durations + word timings, imported by TS
 *
 * Everything is cached by a hash of (text + voice + rate), so re-running is
 * cheap and only pays for lines that actually changed.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import edgeTts from "@andresaya/edge-tts";

const { EdgeTTS } = edgeTts;

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCRIPT_PATH = path.join(ROOT, "public", "script.json");
const AUDIO_DIR = path.join(ROOT, "public", "voice");
const MANIFEST_PATH = path.join(ROOT, "src", "voice", "manifest.json");

const DEFAULT_VOICE = "en-US-AndrewMultilingualNeural";
/** Natural pace - the narration should sound like a person, not a reel. */
const RATE = "-4%";
const PITCH = "+0Hz";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

/** Peak-normalize every clip so the voice sits at a normal social-video level. */
const TARGET_PEAK_DBFS = -3;
const MAX_GAIN_DB = 12;
const ENCODE_BITRATE = "96k";
const SAMPLE_RATE = 24000;

const force = process.argv.includes("--force");

const sha1 = (value) => createHash("sha1").update(value).digest("hex").slice(0, 12);

const round = (value) => Math.round(value * 1000) / 1000;

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ffmpeg/ffprobe that ship with Remotion - no system install needed.
 * The compositor package name depends on the OS/arch (Windows dev machine vs
 * the Linux GitHub Actions runner).
 */
const COMPOSITOR_PACKAGE = (() => {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  if (process.platform === "win32") return `compositor-win32-${arch}-msvc`;
  if (process.platform === "darwin") return `compositor-darwin-${arch}`;
  return `compositor-linux-${arch}-gnu`;
})();

const findBinary = (name) => {
  const extension = process.platform === "win32" ? ".exe" : "";
  const override = process.env[`${name.toUpperCase()}_PATH`];
  const compositor = path.join(
    ROOT,
    "node_modules",
    "@remotion",
    COMPOSITOR_PACKAGE,
    `${name}${extension}`,
  );
  const fallback = path.join(
    ROOT,
    "node_modules",
    "ffmpeg-static",
    `${name}${extension}`,
  );
  return [override, compositor, fallback].find(
    (candidate) => candidate && fsSync.existsSync(candidate),
  ) ?? `${name}${extension}`;
};

const FFMPEG = findBinary("ffmpeg");
const FFPROBE = findBinary("ffprobe");

const run = (binary, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stderr)
        : reject(new Error(`${path.basename(binary)} exited ${code}: ${stderr.trim()}`)),
    );
  });

/** MP3 files start with an ID3 tag or an 0xFF 0xEx/0xFx frame header. */
const looksLikeMp3 = (buffer) => {
  if (buffer.length < 1024) return false;
  if (buffer.subarray(0, 3).toString("latin1") === "ID3") return true;
  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
};

const synthesize = async (tts, text, voice) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await tts.generate(text, voice, {
        rate: RATE,
        pitch: PITCH,
        outputFormat: OUTPUT_FORMAT,
        timeout: 60000,
      });
      const audio = Buffer.from(result.audio);
      if (!looksLikeMp3(audio)) {
        throw new Error(`response is not an MP3 (${audio.length} bytes)`);
      }
      return { audio, words: result.wordBoundaries ?? [], duration: result.duration };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(700 * attempt);
    }
  }
  throw lastError;
};

let tempCounter = 0;
const tempPath = (extension) =>
  path.join(
    os.tmpdir(),
    `stickman-voice-${process.pid}-${tempCounter++}.${extension}`,
  );

/** Decodes to WAV and returns the absolute peak (0..1). */
const measurePeak = async (audioFile) => {
  const wavFile = tempPath("wav");
  await run(FFMPEG, [
    "-y", "-v", "error",
    "-i", audioFile,
    "-ac", "1",
    "-ar", String(SAMPLE_RATE),
    "-f", "wav",
    wavFile,
  ]);

  const wav = await fs.readFile(wavFile);
  await fs.unlink(wavFile);

  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("latin1", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      const samples = Math.floor(size / 2);
      let peak = 0;
      for (let i = 0; i < samples; i++) {
        const value = Math.abs(wav.readInt16LE(offset + 8 + i * 2));
        if (value > peak) peak = value;
      }
      return peak / 32768;
    }
    offset += 8 + size + (size % 2);
  }

  throw new Error("no data chunk in decoded WAV");
};

/**
 * Applies a flat gain so the clip peaks at `TARGET_PEAK_DBFS`.
 * Unity-gain is applied with ffmpeg's `volume` filter - no dynamics processing,
 * so word timings stay exactly where the TTS reported them.
 */
const normalizeClip = async (audioFile) => {
  const peak = await measurePeak(audioFile);
  if (peak === 0) {
    throw new Error("decoded clip is silent");
  }

  const gainDb = Math.min(
    Math.max(TARGET_PEAK_DBFS - 20 * Math.log10(peak), 0),
    MAX_GAIN_DB,
  );

  if (gainDb < 0.5) {
    return { gainDb: 0, peakDbfs: round(20 * Math.log10(peak)) };
  }

  const out = tempPath("mp3");
  await run(FFMPEG, [
    "-y", "-v", "error",
    "-i", audioFile,
    "-af", `volume=${gainDb.toFixed(2)}dB`,
    "-ac", "1",
    "-ar", String(SAMPLE_RATE),
    "-c:a", "libmp3lame",
    "-b:a", ENCODE_BITRATE,
    out,
  ]);
  await fs.rename(out, audioFile);

  return {
    gainDb: round(gainDb),
    peakDbfs: round(20 * Math.log10(peak) + gainDb),
  };
};

const probeDuration = async (audioFile) => {
  try {
    const stdout = await run(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      audioFile,
    ]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) ? round(value) : undefined;
  } catch {
    return undefined;
  }
};

const main = async () => {
  const script = JSON.parse(await fs.readFile(SCRIPT_PATH, "utf8"));
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];
  if (scenes.length === 0) {
    throw new Error("public/script.json has no scenes");
  }

  const missing = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => typeof scene.voiceover !== "string" || scene.voiceover.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `scenes without a "voiceover" field: ${missing.map((m) => m.index + 1).join(", ")}. ` +
        `Add narration text (or delete the scene) before generating audio.`,
    );
  }

  const voice = script.voice ?? DEFAULT_VOICE;
  const previous = await readJson(MANIFEST_PATH, { scenes: [] });
  const previousByIndex = new Map((previous.scenes ?? []).map((s) => [s.index, s]));

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const tts = new EdgeTTS();
  const generated = [];

  console.log(`voice: ${voice}   rate: ${RATE}   scenes: ${scenes.length}\n`);

  for (let index = 0; index < scenes.length; index++) {
    const text = scenes[index].voiceover.trim();
    const file = `voice/scene-${String(index + 1).padStart(2, "0")}.mp3`;
    const absolute = path.join(ROOT, "public", file);
    const hash = sha1(
      `${voice}|${RATE}|${PITCH}|${TARGET_PEAK_DBFS}|${ENCODE_BITRATE}|${text}`,
    );

    const cached = previousByIndex.get(index);
    const onDisk = await fs
      .stat(absolute)
      .then((stat) => stat.size)
      .catch(() => 0);

    if (!force && cached && cached.hash === hash && onDisk > 0) {
      generated.push({ ...cached, file, text, cached: true });
      console.log(
        `${String(index + 1).padStart(2, "0")}  cached   ${cached.durationInSeconds.toFixed(2)}s  ${text}`,
      );
      continue;
    }

    const result = await synthesize(tts, text, voice);
    await fs.writeFile(absolute, result.audio);

    // Loudness only - gain changes the level, never the timing.
    const normalization = await normalizeClip(absolute);
    const measured = await probeDuration(absolute);

    const words = result.words.map((word) => ({
      text: word.text,
      start: round(word.offset / 1e7),
      end: round((word.offset + word.duration) / 1e7),
    }));

    // Prefer the re-measured clip length; fall back to the last word boundary.
    const duration =
      measured ?? (result.duration > 0 ? result.duration : undefined) ??
      (words[words.length - 1]?.end ?? 0) + 0.15;

    const entry = {
      index,
      file,
      text,
      hash,
      durationInSeconds: round(duration),
      peakDbfs: normalization.peakDbfs,
      gainDb: normalization.gainDb,
      words,
    };

    const size = (await fs.stat(absolute)).size;
    generated.push(entry);
    console.log(
      `${String(index + 1).padStart(2, "0")}  created  ${entry.durationInSeconds.toFixed(2)}s  ` +
        `${(size / 1024).toFixed(1)} KB  ${normalization.gainDb >= 0.5 ? `+${normalization.gainDb} dB` : "no gain"}  ` +
        `${words.length} words  ${text}`,
    );
  }

  const totalSeconds = round(
    generated.reduce((sum, scene) => sum + scene.durationInSeconds, 0),
  );

  const manifest = {
    provider: "@andresaya/edge-tts",
    voice,
    rate: RATE,
    pitch: PITCH,
    outputFormat: OUTPUT_FORMAT,
    normalization: { targetPeakDbfs: TARGET_PEAK_DBFS, maxGainDb: MAX_GAIN_DB },
    generatedAt: new Date().toISOString(),
    totalSeconds,
    scenes: generated.map(({ cached: _cached, ...scene }) => scene),
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\ntotal narration: ${totalSeconds.toFixed(2)}s  ->  ${MANIFEST_PATH.replace(ROOT + path.sep, "")}`,
  );
  console.log(`files: ${AUDIO_DIR.replace(ROOT + path.sep, "")}`);
};

main().catch((error) => {
  console.error(`\nvoiceover generation failed: ${error?.message ?? error}`);
  process.exit(1);
});
