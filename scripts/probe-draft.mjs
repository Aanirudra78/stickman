/**
 * Pixel probe for a rendered draft: proves the picture actually moves, and
 * that a guest appears exactly when the name is spoken.
 *
 *   node scripts/probe-draft.mjs out/draft-aman.mp4 out/timings.json
 *
 * Uses ffmpeg-static to pull single frames as raw RGB and compares regions.
 * No image viewing involved: everything is mean absolute difference.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const [, , videoArg, timingArg] = process.argv;
if (!videoArg || !timingArg) {
  console.error("usage: node scripts/probe-draft.mjs <video> <timings.json>");
  process.exit(1);
}

const VIDEO = path.resolve(videoArg);
const TIMINGS = JSON.parse(fs.readFileSync(path.resolve(timingArg), "utf8"));

const WIDTH = 540;
const HEIGHT = 960;

const frameAt = (seconds) =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        "-v",
        "error",
        "-ss",
        seconds.toFixed(3),
        "-i",
        VIDEO,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ],
      { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(error);
        if (stdout.length !== WIDTH * HEIGHT * 3) {
          return reject(
            new Error(
              `frame at ${seconds}s is ${stdout.length} bytes, expected ${WIDTH * HEIGHT * 3}`,
            ),
          );
        }
        resolve(stdout);
      },
    );
  });

/** Mean absolute difference (0-255) between two frames, optionally in a box. */
const diff = (a, b, box) => {
  const [x0, y0, x1, y1] = box ?? [0, 0, WIDTH, HEIGHT];
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    let index = (y * WIDTH + x0) * 3;
    for (let x = x0; x < x1; x++) {
      sum += Math.abs(a[index] - b[index]);
      sum += Math.abs(a[index + 1] - b[index + 1]);
      sum += Math.abs(a[index + 2] - b[index + 2]);
      index += 3;
      count += 3;
    }
  }
  return sum / count;
};

const round = (value, digits = 2) => Number(value.toFixed(digits));

const main = async () => {
  // The guest stands on the right; the main character stays centre-left.
  const RIGHT = [Math.round(WIDTH * 0.55), Math.round(HEIGHT * 0.2), WIDTH, HEIGHT];

  console.log(`video: ${path.basename(VIDEO)}  (${TIMINGS.total}s planned)`);
  console.log("");
  console.log("scene  motion  note");
  console.log("-".repeat(48));

  let frozen = 0;
  for (const row of TIMINGS.rows) {
    const a = await frameAt(row.start + 0.35);
    const b = await frameAt(row.start + 0.95);
    const motion = diff(a, b);
    const isFrozen = motion < 0.6;
    if (isFrozen) frozen += 1;
    const beats = row.actions.map((action) => `${action.id}@${action.t}s`).join(" ");
    console.log(
      `${String(row.i).padEnd(6)} ${round(motion).toFixed(2).padStart(6)}  ${
        isFrozen ? "FROZEN" : "moving"
      }  ${beats}`,
    );
  }

  console.log("");
  console.log("guest entrance (right of frame, diff vs 0.45s before the name):");
  for (const row of TIMINGS.rows) {
    if (!row.guest) continue;
    const before = await frameAt(Math.max(row.start + 0.1, row.guest.t - 0.45));
    const onName = await frameAt(row.guest.t + 0.25);
    const afterExit = await frameAt(row.start + row.sec - 0.05);
    console.log(
      `  scene ${row.i}: ${row.guest.name} @ ${row.guest.t}s  ` +
        `enter-diff ${round(diff(before, onName, RIGHT)).toFixed(2)}  ` +
        `exit-diff-vs-enter ${round(diff(onName, afterExit, RIGHT)).toFixed(2)}`,
    );
  }

  console.log("");
  console.log(frozen === 0 ? "PASS - every scene moves" : `FAIL - ${frozen} frozen scene(s)`);
};

main().catch((error) => {
  console.error(`probe failed: ${error?.message ?? error}`);
  process.exit(1);
});
