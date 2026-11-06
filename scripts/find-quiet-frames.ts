/**
 * Lists frames where the character is NOT speaking and NOT blinking, grouped by
 * settled pose. Used to pick still frames for the pixel probes: a mid-speech
 * mouth is a cross-fade of the smile curve and the open "O", so measuring a
 * pose's mouth shape only makes sense on a silent frame.
 *
 *   npx tsc scripts/find-quiet-frames.ts --outDir .tmp-check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck \
 *     --resolveJsonModule
 *   node .tmp-check/scripts/find-quiet-frames.js
 */
import rawScript from "../public/script.json";
import { parseScript } from "../src/script/parseScript";
import {
  buildPoseKeyframes,
  getActivePose,
  getSceneWindows,
} from "../src/timeline/timeline";
import {
  getItemRevealSeconds,
  getSpeechEndSeconds,
  isWordActiveAt,
} from "../src/voice/voiceover";

const FPS = 30;
const script = parseScript(rawScript);

/** Same blink curve as `getEyeOpenness()`: open most of the time. */
const blinkOpen = (frame: number) => {
  const period = Math.round(FPS * 3.2);
  const blinkLength = Math.max(3, Math.round(FPS * 0.13));
  return (frame + Math.round(FPS * 1.3)) % period >= blinkLength;
};

const speechEnds = script.scenes.map((_, index) => getSpeechEndSeconds(index));
const windows = getSceneWindows(script.scenes, FPS, speechEnds);
const itemReveals = script.scenes.map((scene, index) =>
  scene.scene_type === "points" ? getItemRevealSeconds(index, scene.items ?? []) : [],
);
const keyframes = buildPoseKeyframes(script.scenes, FPS, speechEnds, itemReveals);

type Group = { scene: number; pose: string; from: number; to: number };
const groups: Group[] = [];

for (let frame = 0; frame < windows[windows.length - 1].end; frame++) {
  const window = windows.find((w) => frame >= w.start && frame < w.end);
  if (!window) continue;

  const active = getActivePose(keyframes, frame);
  const quiet =
    frame >= window.start + 10 &&
    frame < window.end - 12 &&
    blinkOpen(frame) &&
    active.framesSinceChange >= 10 &&
    active.sceneIndex === window.index &&
    !isWordActiveAt(window.index, (frame - window.start) / FPS);

  if (!quiet) continue;

  const previous = groups[groups.length - 1];
  if (
    previous &&
    previous.scene === window.index + 1 &&
    previous.pose === active.to &&
    previous.to === frame - 1
  ) {
    previous.to = frame;
  } else {
    groups.push({
      scene: window.index + 1,
      pose: active.to,
      from: frame,
      to: frame,
    });
  }
}

for (const group of groups) {
  const mid = Math.round((group.from + group.to) / 2);
  console.log(
    `scene ${group.scene}  ${group.pose.padEnd(9)}  frames ${group.from}..${group.to}`.padEnd(52) +
      `  quiet still: ${mid}`,
  );
}
