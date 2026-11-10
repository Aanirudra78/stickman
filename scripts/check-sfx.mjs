/**
 * Proves an SFX file actually fired inside a rendered video by cross-correlating
 * the rendered PCM against the SFX waveform (both decoded to 16k mono).
 *
 *   node scripts/check-sfx.mjs out/video.mp4 public/sfx/tick.wav 11.65 13.78
 *   ... any number of candidate times (seconds). Prints the best normalised
 *   correlation in a +/-60ms window and always a far-away control.
 *
 * Signs flip with resampler phase; magnitude is the signal. With ~0.1s tonal
 * templates expect >= 0.15 when the effect is in the mix and ~0.04 when not.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SAMPLE_RATE = 16000;

const [, , videoArg, sfxArg, ...times] = process.argv;
if (!videoArg || !sfxArg || times.length === 0) {
  console.error("usage: node scripts/check-sfx.mjs <video> <sfx.wav> <t1> [t2 ...]");
  process.exit(1);
}

let decodeCount = 0;

const findFfmpeg = () => {
  const base = path.join(ROOT, "node_modules");
  for (const candidate of [
    path.join(base, "ffmpeg-static", "ffmpeg.exe"),
    path.join(base, "ffmpeg-static", "ffmpeg"),
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("no ffmpeg-static");
};

const decodePcm = (ffmpeg, file) =>
  new Promise((resolve, reject) => {
    // Unique temp name: two parallel decodes would fight over one file.
    const wavFile = path.join(ROOT, "out", `.sfx-probe-${process.pid}-${decodeCount++}.wav`);
    const child = spawn(ffmpeg, [
      "-y", "-v", "error", "-i", file,
      "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "wav", wavFile,
    ]);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code} for ${file}`));
      let wav;
      try {
        wav = fs.readFileSync(wavFile);
      } finally {
        fs.unlinkSync(wavFile);
      }
      let offset = 12;
      while (offset + 8 <= wav.length) {
        const id = wav.toString("latin1", offset, offset + 4);
        const size = wav.readUInt32LE(offset + 4);
        if (id === "data") {
          const pcm = wav.subarray(offset + 8, offset + 8 + size);
          const samples = [];
          for (let i = 0; i + 2 <= pcm.length; i += 2) {
            samples.push(pcm.readInt16LE(i));
          }
          resolve(samples);
          return;
        }
        offset += 8 + size + (size % 2);
      }
      reject(new Error("no data chunk"));
    });
  });

/** Max normalised cross-correlation of the template within +/- WINDOW seconds. */
const WINDOW = 0.08;

const bestCorrelation = (video, template, seconds) => {
  const startSample = Math.round(seconds * SAMPLE_RATE);
  const templateStart = startSample - Math.round(WINDOW * SAMPLE_RATE);
  const templateEnd = startSample + Math.round(WINDOW * SAMPLE_RATE) + template.length;

  // The template mean can be non-zero (tiny DC); normalise both windows.
  let templateEnergy = 0;
  let templateMean = 0;
  for (const sample of template) templateMean += sample;
  templateMean /= template.length;
  for (const sample of template) templateEnergy += (sample - templateMean) ** 2;

  let best = { value: 0, delta: 0 };
  for (
    let offset = templateStart;
    offset + template.length <= templateEnd;
    offset += Math.round(SAMPLE_RATE * 0.005)
  ) {
    if (offset < 0) continue;
    let windowEnergy = 0;
    let windowMean = 0;
    for (let i = 0; i < template.length; i++) windowMean += video[offset + i];
    windowMean /= template.length;
    let dot = 0;
    for (let i = 0; i < template.length; i++) {
      const a = video[offset + i] - windowMean;
      const b = template[i] - templateMean;
      dot += a * b;
      windowEnergy += a * a;
    }
    if (windowEnergy === 0 || templateEnergy === 0) continue;
    const value = dot / Math.sqrt(windowEnergy * templateEnergy);
    if (Math.abs(value) > Math.abs(best.value)) {
      best = { value, delta: (offset - startSample) / SAMPLE_RATE };
    }
  }
  return best;
};

const main = async () => {
  const ffmpeg = findFfmpeg();
  const [videoPcm, templatePcm] = await Promise.all([
    decodePcm(ffmpeg, path.resolve(ROOT, videoArg)),
    decodePcm(ffmpeg, path.resolve(ROOT, sfxArg)),
  ]);
  console.log(`template: ${path.basename(sfxArg)}  ${templatePcm.length} samples`);

  // A far-away moment as the noise floor for comparison.
  const totalSeconds = videoPcm.length / SAMPLE_RATE;
  const control = bestCorrelation(videoPcm, templatePcm, totalSeconds - 1.2);
  console.log(`control (t=${(totalSeconds - 1.2).toFixed(2)}s): ${control.value.toFixed(3)}`);

  let hits = 0;
  for (const timeArg of times) {
    const seconds = Number(timeArg);
    const best = bestCorrelation(videoPcm, templatePcm, seconds);
    const hit = Math.abs(best.value) >= 0.25 && Math.abs(best.delta) <= 0.15;
    if (hit) hits += 1;
    console.log(
      `${hit ? "FIRED" : "MISS "}  t=${seconds.toFixed(3)}s  corr=${best.value.toFixed(3)}  at ${best.delta >= 0 ? "+" : ""}${best.delta.toFixed(3)}s`,
    );
  }
  process.exit(hits === 0 ? 1 : 0);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
