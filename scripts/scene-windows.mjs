/**
 * Shared scene-window math for the QA scripts and the local tools.
 *
 * Rule (same as src/timeline/timeline.ts): a narrated scene keeps the narration
 * plus a tail, but never stretches past the narration more than
 * HOLD_SECONDS + TAIL_SECONDS, even when the pre-audio estimate runs long.
 *
 *   import { sceneWindows, FPS } from "./scene-windows.mjs";
 *   const windows = sceneWindows(script, manifest);
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export const FPS = 30;
export const TAIL_SECONDS = 0.45;
/** Same cap as `VOICE_HOLD_SECONDS` in src/timeline/timeline.ts. */
export const HOLD_SECONDS = 0.6;

export const readScript = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "public", "script.json"), "utf8"));

export const readManifest = () =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "src", "voice", "manifest.json"), "utf8"));

/**
 * @param script  public/script.json
 * @param manifest src/voice/manifest.json (may be empty)
 * @returns [{ index, start, end, durationInFrames, speechEnd }]
 */
export const sceneWindows = (
  script,
  manifest,
  { fps = FPS, tail = TAIL_SECONDS, hold = HOLD_SECONDS } = {},
) => {
  let cursor = 0;
  return script.scenes.map((scene, index) => {
    const voice = (manifest.scenes ?? []).find((entry) => entry.index === index);
    const words = voice?.words ?? [];
    const speechEnd = words.length > 0 ? words[words.length - 1].end : 0;
    const minFrames = Math.round(scene.duration * fps);
    const cappedMinFrames = voice
      ? Math.min(minFrames, Math.ceil((speechEnd + tail + hold) * fps))
      : minFrames;
    const durationInFrames = Math.max(
      1,
      cappedMinFrames,
      voice && words.length > 0 ? Math.ceil((speechEnd + tail) * fps) : 0,
    );
    const window = {
      index,
      start: cursor / fps,
      end: (cursor + durationInFrames) / fps,
      durationInFrames,
      speechEnd,
    };
    cursor += durationInFrames;
    return window;
  });
};
