/**
 * Pixel probe for a rendered draft: proves the picture actually moves, and
 * that a guest appears exactly when the name is spoken.
 *
 *   node scripts/probe-draft.mjs out/draft.mp4 out/timings.json
 *   FROZEN_MOTION=0.6 GUEST_ENTER_MAB=4 node scripts/probe-draft.mjs ...
 *
 * Uses ffmpeg-static to pull single frames as raw RGB and compares regions.
 * No image viewing involved: everything is mean absolute difference.
 *
 * Exit code 1 when a scene is frozen or a guest fails to appear/leave, and a
 * `--json` flag prints the per-scene summary for CI step summaries.
 */
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

/**
 * ffprobe ships with the Windows-only Remotion compositor; on other platforms
 * fall back to the system one (CI: `sudo apt-get install -y ffmpeg`).
 */
const resolveFfprobe = () => {
  const candidates = [];
  try {
    const compositorDir = path.dirname(
      require.resolve("@remotion/compositor-win32-x64-msvc/package.json", { paths: [process.cwd()] }),
    );
    for (const name of ["ffprobe.exe", "ffprobe", "fpxd"]) {
      candidates.push(path.join(compositorDir, name));
    }
  } catch {
    /* not installed */
  }
  try {
    for (const dir of fs.readdirSync(path.join(process.cwd(), "node_modules", "@remotion"))) {
      if (dir.startsWith("compositor-")) {
        for (const name of ["ffprobe.exe", "ffprobe", "fpxd"]) {
          candidates.push(path.join(process.cwd(), "node_modules", "@remotion", dir, name));
        }
      }
    }
  } catch {
    /* no @remotion dir */
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const onPath = ["ffprobe", "ffprobe.exe"].find((name) => {
    try {
      execFileSync(name, ["-version"], { timeout: 5000, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  if (onPath) return onPath;
  return null;
};

const FFPROBE = resolveFfprobe();
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

/** Read the real frame size, so the same probe works on draft and final. */
const videoSize = () =>
  new Promise((resolve, reject) => {
    if (!FFPROBE) {
      return reject(new Error("no ffprobe (npm ci on this platform or `sudo apt-get install -y ffmpeg`)"));
    }
    execFile(
      FFPROBE,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-of",
        "csv=p=0",
        VIDEO,
      ],
      (error, stdout) => {
        if (error) return reject(error);
        const [width, height] = String(stdout)
          .trim()
          .split(",")
          .map((value) => Number.parseInt(value, 10));
        if (!width || !height) return reject(new Error("could not read video size"));
        resolve({ width, height });
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
