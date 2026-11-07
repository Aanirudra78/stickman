/**
 * Keeps the delivered file small enough to download comfortably on a phone.
 *
 *   node scripts/compress-if-needed.mjs out/video.mp4 [--max-mb=45]
 *
 * If the render is already under the limit it is passed through untouched.
 * Otherwise it is re-encoded to a target bitrate computed from its duration,
 * which keeps the size predictable instead of hoping for a CRF to be enough.
 *
 * Writes `out=...` to $GITHUB_OUTPUT so the workflow can use the result.
 */
import { spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const COMPOSITOR_PACKAGE = (() => {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  if (process.platform === "win32") return `compositor-win32-${arch}-msvc`;
  if (process.platform === "darwin") return `compositor-darwin-${arch}`;
  return `compositor-linux-${arch}-gnu`;
})();

const findBinary = (name) => {
  const extension = process.platform === "win32" ? ".exe" : "";
  const candidates = [
    process.env[`${name.toUpperCase()}_PATH`],
    path.join(
      ROOT,
      "node_modules",
      "@remotion",
      COMPOSITOR_PACKAGE,
      `${name}${extension}`,
    ),
  ];
  return (
    candidates.find(
      (candidate) => candidate && fsSync.existsSync(candidate),
    ) ?? `${name}${extension}`
  );
};

const FFMPEG = findBinary("ffmpeg");
const FFPROBE = findBinary("ffprobe");

const run = (binary, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${path.basename(binary)} exited ${code}: ${stderr.trim()}`)),
    );
  });

const probeDuration = async (file) => {
  try {
    const stdout = await run(FFPROBE, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      file,
    ]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value : 60;
  } catch {
    return 60;
  }
};

const setOutput = async (name, value) => {
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
};

const main = async () => {
  const input = process.argv[2];
  if (!input) {
    console.error("usage: node scripts/compress-if-needed.mjs <video.mp4> [--max-mb=45]");
    process.exit(1);
  }

  const maxArg = process.argv.find((arg) => arg.startsWith("--max-mb="));
  const maxMb = maxArg ? Number.parseFloat(maxArg.split("=")[1]) : 45;
  const maxBytes = Math.floor(maxMb * 1024 * 1024);

  const absolute = path.resolve(process.cwd(), input);
  const { size } = await fs.stat(absolute);
  console.log(
    `render: ${(size / (1024 * 1024)).toFixed(1)} MB (limit ${maxMb} MB)`,
  );

  if (size <= maxBytes) {
    await setOutput("out", absolute);
    return;
  }

  const duration = await probeDuration(absolute);
  const audioBits = 128_000;
  const videoBits = Math.max(
    600_000,
    Math.floor((maxBytes * 8 * 0.92) / duration) - audioBits,
  );
  const output = absolute.replace(/\.mp4$/i, "-telegram.mp4");

  console.log(
    `compressing to ~${(videoBits / 1_000_000).toFixed(2)} Mbps for ${duration.toFixed(1)}s`,
  );

  await run(FFMPEG, [
    "-y", "-v", "error",
    "-i", absolute,
    "-c:v", "libx264",
    "-preset", "medium",
    "-b:v", String(videoBits),
    "-maxrate", String(Math.round(videoBits * 1.4)),
    "-bufsize", String(videoBits * 2),
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    output,
  ]);

  const compressed = await fs.stat(output);
  console.log(
    `compressed: ${(compressed.size / (1024 * 1024)).toFixed(1)} MB -> ${output}`,
  );
  await setOutput("out", output);
};

main().catch((error) => {
  console.error(`compression failed: ${error?.message ?? error}`);
  process.exit(1);
});
