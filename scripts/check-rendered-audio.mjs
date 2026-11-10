/**
 * Proves the narration actually made it into the rendered MP4 and that each
 * scene's audio starts on its scene window.
 *
 * Decodes the rendered file to mono PCM with the ffmpeg that ships inside
 * `@remotion/compositor-*`, then computes RMS per 100ms block and matches the
 * blocks against the scene windows from the script + voice manifest.
 *
 *   node scripts/check-rendered-audio.mjs [out/stickman-test.mp4]
 *
 * Fails when a scene window is silent (< -50 dBFS) or when speech starts more
 * than 0.25s away from the scene start.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FPS, ROOT, readManifest, readScript, sceneWindows } from "./scene-windows.mjs";

const BLOCK_SECONDS = 0.1;
const SAMPLE_RATE = 16000;
const SILENCE_DBFS = -50;
const MAX_START_OFFSET_SECONDS = 0.25;

const videoFile = path.resolve(ROOT, process.argv[2] ?? "out/stickman-test.mp4");

const findFfmpeg = () => {
  const base = path.join(ROOT, "node_modules");
  const candidates = [
    ...(process.platform === "win32"
      ? [
          path.join(base, "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe"),
          path.join(base, "ffmpeg-static", "ffmpeg.exe"),
        ]
      : [
          path.join(base, "ffmpeg-static", "ffmpeg"),
          path.join(base, "@remotion", "compositor-linux-x64-gnu-msvc", "ffmpeg"),
          path.join(base, "@remotion", "compositor-darwin-x64-msvc", "ffmpeg"),
        ]),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("no ffmpeg found (looked in node_modules/ffmpeg-static and @remotion/compositor-*)");
};

const decodePcm = (ffmpeg, file) =>
  new Promise((resolve, reject) => {
    // The ffmpeg shipped with Remotion has a trimmed muxer list (no raw PCM
    // pipe), so decode to a temporary WAV and read the data chunk.
    const wavFile = path.join(
      process.env.TEMP ?? process.env.TMP ?? ".",
      `stickman-audio-check-${process.pid}.wav`,
    );

    const child = spawn(ffmpeg, [
      "-y", "-v", "error",
      "-i", file,
      "-map", "0:a:0",
      "-ac", "1",
      "-ar", String(SAMPLE_RATE),
      "-f", "wav",
      wavFile,
    ]);

    child.stderr.on("data", (chunk) => process.stderr.write(chunk));

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited ${code}`));
        return;
      }
      try {
        const wav = fs.readFileSync(wavFile);
        fs.unlinkSync(wavFile);

        // Walk RIFF chunks until the "data" chunk (headers vary in length).
        let offset = 12;
        while (offset + 8 <= wav.length) {
          const id = wav.toString("latin1", offset, offset + 4);
          const size = wav.readUInt32LE(offset + 4);
          if (id === "data") {
            resolve(wav.subarray(offset + 8, offset + 8 + size));
            return;
          }
          offset += 8 + size + (size % 2);
        }
        reject(new Error("no data chunk in decoded WAV"));
      } catch (error) {
        reject(error);
      }
    });
  });

const rmsToDbfs = (rms) => (rms === 0 ? -Infinity : 20 * Math.log10(rms / 32768));

const main = async () => {
  if (!fs.existsSync(videoFile)) {
    throw new Error(`not found: ${videoFile}`);
  }

  const script = readScript();
  const manifest = readManifest();

  const windows = sceneWindows(script, manifest);

  const pcm = await decodePcm(findFfmpeg(), videoFile);
  const totalSamples = pcm.length / 2;
  const blockSamples = Math.round(SAMPLE_RATE * BLOCK_SECONDS);
  const blocks = [];

  for (let offset = 0; offset + blockSamples <= totalSamples; offset += blockSamples) {
    let sum = 0;
    for (let i = 0; i < blockSamples; i++) {
      const sample = pcm.readInt16LE((offset + i) * 2);
      sum += sample * sample;
    }
    blocks.push({
      start: offset / SAMPLE_RATE,
      dbfs: rmsToDbfs(Math.sqrt(sum / blockSamples)),
    });
  }

  const failures = [];

  console.log(
    `file: ${path.relative(ROOT, videoFile)}   decoded ${(totalSamples / SAMPLE_RATE).toFixed(2)}s ` +
      `mono @ ${SAMPLE_RATE} Hz   blocks: ${blocks.length}\n`,
  );

  for (const window of windows) {
    const inside = blocks.filter((b) => b.start >= window.start && b.start < window.end);
    const loud = inside.filter((b) => b.dbfs > SILENCE_DBFS);

    if (loud.length === 0) {
      failures.push(`scene ${window.index + 1}: no audible narration in its window`);
      console.log(`FAIL  scene ${window.index + 1}  silent`);
      continue;
    }

    const peak = Math.max(...inside.map((b) => b.dbfs));
    const mean = loud.reduce((sum, b) => sum + b.dbfs, 0) / loud.length;
    const speechStart = loud[0].start - window.start;
    const speechSeconds = loud.length * BLOCK_SECONDS;
    const coverage = speechSeconds / (window.end - window.start);

    const startOk = Math.abs(speechStart) <= MAX_START_OFFSET_SECONDS;
    if (!startOk) {
      failures.push(
        `scene ${window.index + 1}: speech starts ${speechStart.toFixed(2)}s after the scene starts`,
      );
    }

    console.log(
      `${startOk ? "PASS" : "FAIL"}  scene ${window.index + 1}  ` +
        `audio ${mean.toFixed(1)} dBFS (peak ${peak.toFixed(1)})  ` +
        `starts +${speechStart.toFixed(2)}s  speech ${(coverage * 100).toFixed(0)}% of window`,
    );
  }

  // Long silent stalls between scenes would mean a lost/misplaced clip.
  const totalSpeech = blocks.filter((b) => b.dbfs > SILENCE_DBFS).length * BLOCK_SECONDS;
  const totalSeconds = blocks.length * BLOCK_SECONDS;
  console.log(
    `\naudio track: ${totalSeconds.toFixed(2)}s, speech ${totalSpeech.toFixed(2)}s ` +
      `(${((totalSpeech / totalSeconds) * 100).toFixed(0)}%)`,
  );

  if (failures.length > 0) {
    console.log(`\n${failures.length} AUDIO FAILURE(S):\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }

  console.log("\nAUDIO OK");
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
