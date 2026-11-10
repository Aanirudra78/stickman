/**
 * Builds `out/timings.json`, the frame-probe plan for `scripts/probe-draft.mjs`.
 *
 * Beats are resolved against the real word timings in the voice manifest (the
 * same resolution the composition does), falling back to the `at` estimates in
 * script.json when a scene has no manifest entry.
 *
 *   node scripts/build-timings.mjs              # out/timings.json
 *   node scripts/build-timings.mjs out/x.json
 */
import fs from "node:fs";
import path from "node:path";
import { FPS, readManifest, readScript, ROOT, sceneWindows } from "./scene-windows.mjs";

const OUT = path.resolve(ROOT, process.argv[2] ?? "out/timings.json");
/** Threshold copied from scripts/probe-draft.mjs: below this MAB the scene is "frozen". */
const FROZEN_MOTION = Number(process.env.FROZEN_MOTION ?? 0.6);

const total = (windows) => windows[windows.length - 1].end;

const beatSeconds = (voice, beat, fallback) => {
  const words = voice?.words ?? [];
  if (typeof beat.word === "number" && words[beat.word]) {
    return words[beat.word].start;
  }
  return beat.at ?? fallback;
};

const main = () => {
  const script = readScript();
  const manifest = readManifest();
  const windows = sceneWindows(script, manifest);

  const rows = windows.map((window, index) => {
    const scene = script.scenes[index];
    const voice = (manifest.scenes ?? []).find((entry) => entry.index === index);
    const guest = scene.guest
      ? {
          name: scene.guest.name,
          t: window.start + beatSeconds(voice, scene.guest, 0),
          exitT: window.end - 0.05,
        }
      : null;
    return {
      i: index + 1,
      text: scene.text,
      start: window.start,
      sec: window.end - window.start,
      actions: (scene.actions ?? []).map((action) => ({
        id: action.id,
        word: action.word ?? null,
        at: Number(action.at?.toFixed(2) ?? 0),
        t: Number(beatSeconds(voice, action, action.at ?? 0).toFixed(2)),
      })),
      guest,
      frozen: scene.scene_type === "still",
    };
  });

  fs.writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fps: FPS,
        scenes: script.scenes.length,
        total: total(windows),
        frozenMotion: FROZEN_MOTION,
        rows,
      },
      null,
      1,
    )}\n`,
  );
  console.log(
    `timings: ${path.relative(ROOT, OUT)}  ${rows.length} scenes  total ${total(windows).toFixed(2)}s`,
  );
};

main();
