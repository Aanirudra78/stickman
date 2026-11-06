/**
 * Verifies that the generated narration and the timeline agree:
 *  - every scene has audio whose text matches `script.json`
 *  - every scene window is long enough for its narration + tail
 *  - every points item is matched to a narration word and finishes in-scene
 *  - points scenes get one pose change per item, spaced out enough to read
 *  - prints the per-scene timing table
 *
 * Run:
 *   npx tsc scripts/check-voice-timing.ts --outDir .tmp-check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck \
 *     --resolveJsonModule
 *   node .tmp-check/scripts/check-voice-timing.js
 */
import rawScript from "../public/script.json";
import { parseScript } from "../src/script/parseScript";
import {
  buildPoseKeyframes,
  getSceneWindows,
  VOICE_TAIL_SECONDS,
} from "../src/timeline/timeline";
import {
  getItemReveals,
  getVoiceScene,
  VOICE_MANIFEST,
} from "../src/voice/voiceover";

const FPS = 30;
/** PointsScene row spring duration, in seconds (ITEM_DURATION = 20 frames). */
const ITEM_ANIM_SECONDS = 20 / FPS;
/** Time the last item should stay readable before the scene ends. */
const READ_HOLD_SECONDS = 0.8;
const failures: string[] = [];

const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) {
    failures.push(`${label}: ${detail}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${detail}`);
};

const script = parseScript(rawScript);
const speechEnds = script.scenes.map((_, index) => {
  const voice = getVoiceScene(index);
  if (!voice) return undefined;
  const last = voice.words[voice.words.length - 1];
  return last ? last.end : voice.durationInSeconds;
});

const windows = getSceneWindows(script.scenes, FPS, speechEnds);
const totalFrames = windows[windows.length - 1].end;

// Same automatic pose plan the video uses: one pose change per points item.
const itemRevealsByScene = script.scenes.map((scene, index) =>
  scene.scene_type === "points" && (scene.pose_changes ?? []).length === 0
    ? getItemReveals(index, scene.items ?? []).map((reveal) => reveal.at)
    : [],
);
const poseKeyframes = buildPoseKeyframes(
  script.scenes,
  FPS,
  speechEnds,
  itemRevealsByScene,
);

console.log(
  `voice: ${VOICE_MANIFEST.voice}   rate: ${VOICE_MANIFEST.rate}   ` +
    `clips: ${VOICE_MANIFEST.scenes.length}   narration: ${VOICE_MANIFEST.totalSeconds.toFixed(2)}s\n`,
);

script.scenes.forEach((scene, index) => {
  const voice = getVoiceScene(index);
  const window = windows[index];
  const start = window.start / FPS;
  const seconds = window.durationInFrames / FPS;
  const speechEnd = speechEnds[index];

  check(
    `scene ${index + 1} has generated audio`,
    Boolean(voice),
    voice ? `${voice.file}  ${voice.durationInSeconds.toFixed(2)}s` : "missing",
  );

  if (!voice || speechEnd === undefined) return;

  check(
    `scene ${index + 1} audio text matches script`,
    voice.text === scene.voiceover?.trim(),
    voice.text === scene.voiceover?.trim() ? "" : "text differs",
  );

  check(
    `scene ${index + 1} clip covers its speech`,
    voice.durationInSeconds + 1e-6 >= speechEnd,
    `clip ${voice.durationInSeconds.toFixed(2)}s >= speech end ${speechEnd.toFixed(2)}s`,
  );

  check(
    `scene ${index + 1} window fits narration + tail`,
    seconds + 1e-6 >= speechEnd + VOICE_TAIL_SECONDS,
    `${seconds.toFixed(2)}s >= ${(speechEnd + VOICE_TAIL_SECONDS).toFixed(2)}s`,
  );

  // points scenes: every item lands on its narration word, and the last one
  // stays readable before the scene ends.
  if (scene.scene_type === "points") {
    const items = scene.items ?? [];
    const reveals = getItemReveals(index, items);
    const last = reveals[reveals.length - 1];
    const lastItemEnd = (last?.at ?? 0) + ITEM_ANIM_SECONDS + READ_HOLD_SECONDS;

    check(
      `scene ${index + 1} items finish inside scene`,
      seconds + 1e-6 >= lastItemEnd,
      `last item readable by ${lastItemEnd.toFixed(2)}s of ${seconds.toFixed(2)}s`,
    );

    const matched = reveals.filter((reveal) => reveal.matched).length;
    check(
      `scene ${index + 1} items matched to narration`,
      items.length > 0 && matched === items.length,
      `${matched}/${items.length}  ${reveals
        .map((reveal) => `${reveal.at.toFixed(2)}s${reveal.matched ? "" : "*"}`)
        .join(", ")}`,
    );

    const own = poseKeyframes.filter((keyframe) => keyframe.sceneIndex === index);
    const auto = own.slice(1);
    const spaced = auto.every(
      (keyframe, i) => i === 0 || keyframe.frame - auto[i - 1].frame >= 8,
    );
    check(
      `scene ${index + 1} one readable pose per item`,
      auto.length === items.length && spaced,
      own
        .map(
          (keyframe) =>
            `${keyframe.pose}@${(keyframe.frame / FPS).toFixed(2)}s`,
        )
        .join(" -> "),
    );
  }

  console.log(
    `      ${start.toFixed(2)}s -> ${(start + seconds).toFixed(2)}s  ` +
      `(${window.durationInFrames}f)  speech ${speechEnd.toFixed(2)}s  ` +
      `silence cut ${(voice.durationInSeconds - speechEnd).toFixed(2)}s`,
  );
});

const spokenSeconds = speechEnds.reduce<number>((sum, end) => sum + (end ?? 0), 0);
const totalSeconds = totalFrames / FPS;
const density = totalSeconds > 0 ? spokenSeconds / totalSeconds : 0;
console.log(
  `\ntotal: ${totalSeconds.toFixed(2)}s (${totalFrames} frames)   ` +
    `speech ${spokenSeconds.toFixed(2)}s (${(density * 100).toFixed(0)}% of runtime)`,
);

check("composition has narration", VOICE_MANIFEST.scenes.length === script.scenes.length,
  `${VOICE_MANIFEST.scenes.length}/${script.scenes.length} clips`);

console.log(
  failures.length === 0
    ? "\nVOICE TIMING OK"
    : `\n${failures.length} VOICE TIMING FAILURE(S):\n- ${failures.join("\n- ")}`,
);

if (failures.length > 0) process.exit(1);
