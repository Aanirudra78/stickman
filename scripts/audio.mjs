/**
 * Shared ffmpeg/ffprobe helpers.
 *
 * Two binaries ship with the project:
 *   - `ffmpeg-static`        full build -> EQ, compressor, limiter (heavy voice)
 *   - `@remotion/compositor` slim build  -> always present, used for ffprobe
 *
 * Override either with FFMPEG_PATH / FFPROBE_PATH.
 */
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const COMPOSITOR_PACKAGE = (() => {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  if (process.platform === "win32") return `compositor-win32-${arch}-msvc`;
  if (process.platform === "darwin") return `compositor-darwin-${arch}`;
  return `compositor-linux-${arch}-gnu`;
})();

const findBinary = (name, { preferStatic = false } = {}) => {
  const extension = process.platform === "win32" ? ".exe" : "";
  const override = process.env[`${name.toUpperCase()}_PATH`];
  const staticBuild = path.join(ROOT, "node_modules", "ffmpeg-static", `${name}${extension}`);
  const compositor = path.join(
    ROOT,
    "node_modules",
    "@remotion",
    COMPOSITOR_PACKAGE,
    `${name}${extension}`,
  );
  const order = preferStatic
    ? [override, staticBuild, compositor]
    : [override, compositor, staticBuild];
  return order.find((candidate) => candidate && fsSync.existsSync(candidate)) ?? `${name}${extension}`;
};

/** Full ffmpeg (all filters). Falls back to the slim compositor build. */
export const FFMPEG = findBinary("ffmpeg", { preferStatic: true });
/** ffprobe only ships with the compositor package. */
export const FFPROBE = findBinary("ffprobe");
export const HAS_FULL_FFMPEG = fsSync.existsSync(
  path.join(ROOT, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
);

/**
 * "Heavy narrator" chain: removes rumble, adds weight, evens out the dynamics
 * and stops the clip from clipping. Timings are untouched, so lip sync stays.
 */
export const HEAVY_CHAIN = [
  "highpass=f=70",
  "lowshelf=f=180:g=2",
  "equalizer=f=3000:t=q:w=1.2:g=1.5",
  "acompressor=threshold=0.125:ratio=2.5:attack=5:release=160:makeup=1.4",
  "alimiter=limit=0.72:level=disabled",
].join(",");

export const run = (binary, args, { timeoutMs = 120000 } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${path.basename(binary)} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(binary)} exited ${code}: ${stderr.trim().slice(-800)}`));
    });
  });

let tempCounter = 0;
export const tempPath = (extension) =>
  path.join(os.tmpdir(), `stickman-audio-${process.pid}-${Date.now()}-${tempCounter++}.${extension}`);

export const round = (value) => Math.round(value * 1000) / 1000;

/** Decodes to WAV and returns the absolute peak (0..1). */
export const measurePeak = async (audioFile, sampleRate = 24000) => {
  const wavFile = tempPath("wav");
  await run(FFMPEG, [
    "-y", "-v", "error",
    "-i", audioFile,
    "-ac", "1",
    "-ar", String(sampleRate),
    "-f", "wav",
    wavFile,
  ]);

  const wav = await fs.readFile(wavFile);
  await fs.unlink(wavFile).catch(() => {});

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

export const probeDuration = async (audioFile) => {
  try {
    const { stdout } = await run(FFPROBE, [
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

/**
 * Applies peak normalization and (optionally) the heavy chain in ONE encode,
 * then writes the result back to `audioFile`.
 */
export const processClip = async (
  audioFile,
  {
    targetPeakDbfs = -3,
    maxGainDb = 12,
    chain = "",
    sampleRate = 24000,
    bitrate = "96k",
  } = {},
) => {
  const peak = await measurePeak(audioFile, sampleRate);
  if (peak === 0) {
    throw new Error("decoded clip is silent");
  }

  const gainDb = Math.min(
    Math.max(targetPeakDbfs - 20 * Math.log10(peak), 0),
    maxGainDb,
  );

  const filters = [
    gainDb >= 0.5 ? `volume=${gainDb.toFixed(2)}dB` : null,
    chain || null,
  ]
    .filter(Boolean)
    .join(",");

  if (!filters) {
    return { gainDb: 0, peakDbfs: round(20 * Math.log10(peak)) };
  }

  const encode = async (filterString) => {
    const out = tempPath("mp3");
    await run(FFMPEG, [
      "-y", "-v", "error",
      "-i", audioFile,
      "-af", filterString,
      "-ac", "1",
      "-ar", String(sampleRate),
      "-c:a", "libmp3lame",
      "-b:a", bitrate,
      out,
    ]);
    await fs.rename(out, audioFile);
  };

  try {
    await encode(filters);
  } catch (error) {
    if (!chain) throw error;
    // The slim compositor build has no EQ/compressor: fall back to loudness.
    console.warn(`  ! heavy chain unavailable, using loudnorm (${error.message.split("\n")[0]})`);
    const fallback = [
      gainDb >= 0.5 ? `volume=${gainDb.toFixed(2)}dB` : null,
      "loudnorm=I=-15:TP=-3:LRA=9",
    ]
      .filter(Boolean)
      .join(",");
    await encode(fallback);
  }

  return {
    gainDb: round(gainDb),
    peakDbfs: round(20 * Math.log10(peak) + gainDb),
  };
};
