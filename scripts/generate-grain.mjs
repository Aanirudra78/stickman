/**
 * Generates the fine film-grain tile used by the background overlay.
 *
 *   node scripts/generate-grain.mjs
 *
 * No dependencies: builds a 256x256 grayscale PNG by hand (zlib is built in).
 * The noise is seeded, so the texture is identical on every machine/render
 * (a non-deterministic grain would shimmer between Remotion render workers).
 */
import { deflateSync } from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT = path.join(ROOT, "public", "textures", "grain.png");

const SIZE = 256;
const SEED = 0x2f6e2b1;

// Numerical Recipes LCG - fast, deterministic, good enough for grain.
let state = SEED;
const randomByte = () => {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state >>> 24;
};

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // grayscale
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

// Raw scanlines: one filter byte (0 = none) + SIZE grayscale bytes.
const raw = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE + 1);
  raw[row] = 0;
  for (let x = 0; x < SIZE; x++) {
    // Centre the noise around mid-grey so `multiply` darkens only slightly.
    raw[row + 1 + x] = 96 + (randomByte() % 96);
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, png);
console.log(`grain: ${path.relative(ROOT, OUT)}  ${(png.length / 1024).toFixed(1)} KB`);
