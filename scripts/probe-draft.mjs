/**
 * Pixel probe for a rendered draft: proves the picture actually moves, and
 * that a guest appears exactly when the name is spoken.
 *
 *   node scripts/probe-draft.mjs out/draft.mp4 out/timings.json
 *   FROZEN_MOTION=0.6 GUEST_ENTER_MAB=4 node scripts/probe-draft.mjs ...
 *
 * Uses ffmpeg-static for everything (frames AND the size probe), so CI never
 * needs a system ffmpeg/ffprobe install.
 * No image viewing involved: everything is mean absolute difference.
 *
 * Exit code 1 when a scene is frozen or a guest fails to appear/leave, and a
 * `--json` flag prints the per-scene summary for CI step summaries.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const FROZEN_MOTION = Number(process.env.FROZEN_MOTION ?? 0.6);
const GUEST_ENTER_MAB = Number(process.env.GUEST_ENTER_MAB ?? 4);
const JSON_OUT = process.argv.includes("--json");

const [, , ...rest] = process.argv;
const positional = rest.filter((value) => !value.startsWith("--"));
const [videoArg, timingArg] = positional;
if (!videoArg || !timingArg) {
  console.error("usage: node scripts/probe-draft.mjs <video> <timings.json> [--json]");
  process.exit(1);
}

const VIDEO = path.resolve(videoArg);
const TIMINGS = JSON.parse(fs.readFileSync(path.resolve(timingArg), "utf8"));

/** Read the real frame size, so the same probe works on draft and final.
 *  `ffmpeg -i` prints stream info (including WxH) to stderr and exits 1 —
 *  parse it instead of depending on ffprobe being installed. */
const videoSize = () =>
  new Promise((resolve, reject) => {
    execFile(
      ffmpeg,
      ["-hide_banner", "-i", VIDEO],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
      (_error, _stdout, stderr) => {
        const matches = [...String(stderr).matchAll(/(\d{2,5})x(\d{2,5})/g)];
        for (const match of matches) {
          const width = Number.parseInt(match[1], 10);
          const height = Number.parseInt(match[2], 10);
          // Skip codec detail like "h264 profile 578x..." — a real frame is
          // even-sized and at least ~64px.
          if (width >= 64 && height >= 64 && width % 2 === 0 && height % 2 === 0) {
            return resolve({ width, height });
          }
        }
        reject(new Error("could not read video size from ffmpeg -i"));
      },
    );
  });

let WIDTH = 540;
let HEIGHT = 960;

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
  const size = await videoSize();
  WIDTH = size.width;
  HEIGHT = size.height;
  // The guest stands on the right; the main character stays centre-left.
  const RIGHT = [Math.round(WIDTH * 0.55), Math.round(HEIGHT * 0.2), WIDTH, HEIGHT];

  if (!JSON_OUT) {
    console.log(`video: ${path.basename(VIDEO)}  ${WIDTH}x${HEIGHT}  (${TIMINGS.total}s planned)`);
    console.log("");
    console.log("scene  motion  note");
    console.log("-".repeat(48));
  }

  const summary = { video: path.basename(VIDEO), width: WIDTH, height: HEIGHT, rows: [], guests: [] };
  const frozenNames = [];

  for (const row of TIMINGS.rows) {
    if (row.frozen) {
      if (!JSON_OUT) console.log(`${String(row.i).padEnd(6)} ${"-".padStart(6)}  by-design  (still scene)`);
      summary.rows.push({ scene: row.i, motion: null, state: "by-design" });
      continue;
    }
    const a = await frameAt(row.start + 0.35);
    const b = await frameAt(row.start + 0.95);
    const motion = diff(a, b);
    const isFrozen = motion < FROZEN_MOTION;
    if (isFrozen) frozenNames.push(row.i);
    summary.rows.push({ scene: row.i, motion: round(motion, 3), state: isFrozen ? "FROZEN" : "moving" });
    if (!JSON_OUT) {
      const beats = row.actions.map((action) => `${action.id}@${action.t}s`).join(" ");
      console.log(
        `${String(row.i).padEnd(6)} ${round(motion).toFixed(2).padStart(6)}  ${
          isFrozen ? "FROZEN" : "moving"
        }  ${beats}`,
      );
    }
  }

  if (!JSON_OUT) {
    console.log("");
    console.log("guest entrance (right of frame, diff vs 0.45s before the name):");
  }
  for (const row of TIMINGS.rows) {
    if (!row.guest) continue;
    const before = await frameAt(Math.max(row.start + 0.1, row.guest.t - 0.45));
    const onName = await frameAt(row.guest.t + 0.25);
    const afterExit = await frameAt(row.guest.exitT ?? row.start + row.sec - 0.05);
    const enter = diff(before, onName, RIGHT);
    const leave = diff(onName, afterExit, RIGHT);
    const appeared = enter >= GUEST_ENTER_MAB;
    const left = leave >= 1;
    summary.guests.push({
      scene: row.i,
      name: row.guest.name,
      enterMab: round(enter, 3),
      exitMab: round(leave, 3),
      appeared,
      left,
    });
    if (!JSON_OUT) {
      console.log(
        `  scene ${row.i}: ${row.guest.name} @ ${row.guest.t}s  ` +
          `enter-diff ${round(enter).toFixed(2)}  ` +
          `exit-diff-vs-enter ${round(leave).toFixed(2)}`,
      );
    }
  }

  const guestFailures = summary.guests.filter((guest) => !guest.appeared);
  const pass = frozenNames.length === 0 && guestFailures.length === 0;
  summary.frozen = frozenNames;
  summary.pass = pass;

  if (JSON_OUT) {
    process.stdout.write(JSON.stringify(summary, null, 1));
    return;
  }

  console.log("");
  console.log(
    "entrance ok" +
      (guestFailures.length > 0 ? "" : ` for ${summary.guests.length} guest(s)`) +
      (frozenNames.length > 0 ? "" : ", every scene moves"),
  );
  console.log(pass ? "PASS" : `FAIL - ${frozenNames.length} frozen, ${guestFailures.length} guest failure(s)`);
  if (!pass) process.exit(1);
};

main().catch((error) => {
  console.error(`probe failed: ${error?.message ?? error}`);
  process.exit(1);
});
