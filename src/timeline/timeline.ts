import type { Scene, SceneType } from "../config";
import type { PoseName } from "../poses/poses";
import { FPS } from "../config";

/**
 * Pure timeline math: scene windows and pose keyframes.
 * Everything is expressed in composition frames (30 fps).
 */

export type SceneWindow = {
  index: number;
  start: number;
  durationInFrames: number;
  end: number;
};

/** Silent hold after the last spoken word, so text can be read. */
export const VOICE_TAIL_SECONDS = 0.45;

/**
 * Per-scene duration.
 *
 * `scene.duration` is a minimum. When the scene has narration, the scene grows
 * to fit it: last spoken word + `VOICE_TAIL_SECONDS`. We size from the last
 * word (not the clip length) because the TTS clips carry ~0.8s of trailing
 * silence that would otherwise pad the video.
 */
export const getSceneWindows = (
  scenes: readonly Scene[],
  fps: number = FPS,
  speechEndsInSeconds: readonly (number | undefined)[] = [],
): SceneWindow[] => {
  let cursor = 0;

  return scenes.map((scene, index) => {
    const minFrames = Math.round(scene.duration * fps);
    const speechEnd = speechEndsInSeconds[index];
    const voiceFrames =
      speechEnd === undefined
        ? 0
        : Math.ceil((speechEnd + VOICE_TAIL_SECONDS) * fps);

    const durationInFrames = Math.max(1, minFrames, voiceFrames);
    const window: SceneWindow = {
      index,
      start: cursor,
      durationInFrames,
      end: cursor + durationInFrames,
    };
    cursor += durationInFrames;
    return window;
  });
};

export const getTotalDurationInFrames = (
  scenes: readonly Scene[],
  fps: number = FPS,
  speechEndsInSeconds: readonly (number | undefined)[] = [],
): number => {
  const windows = getSceneWindows(scenes, fps, speechEndsInSeconds);
  return windows[windows.length - 1].end;
};

export const getSceneIndexAtFrame = (
  windows: readonly SceneWindow[],
  frame: number,
): number => {
  for (let i = windows.length - 1; i >= 0; i--) {
    if (frame >= windows[i].start) {
      return i;
    }
  }
  return 0;
};

export type PoseKeyframe = {
  frame: number;
  pose: PoseName;
  /** Scene that owns this keyframe (used to read the speaking flag). */
  sceneIndex: number;
};

/** Pose each new point gets in a points scene (cycles if there are more). */
export const POINTS_POSE_CYCLE: readonly PoseName[] = [
  "pointing",
  "thinking",
  "talking",
  "idle",
];

/**
 * Flattens scene poses + optional `pose_changes` into one ordered list.
 * A pose change is just another keyframe, so it gets the same 8-frame blend.
 *
 * Points scenes without explicit `pose_changes` get automatic pose changes
 * keyed to their item reveal times, so the character acts out each point
 * (point -> think -> talk) instead of standing frozen through the whole list.
 */
export const buildPoseKeyframes = (
  scenes: readonly Scene[],
  fps: number = FPS,
  speechEndsInSeconds: readonly (number | undefined)[] = [],
  pointsItemRevealsInSeconds: readonly (readonly number[])[] = [],
): PoseKeyframe[] => {
  const windows = getSceneWindows(scenes, fps, speechEndsInSeconds);
  const keyframes: PoseKeyframe[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const window = windows[sceneIndex];
    keyframes.push({ frame: window.start, pose: scene.pose, sceneIndex });

    const changes = scene.pose_changes ?? [];
    for (const change of changes) {
      const frame = window.start + Math.round(change.at * fps);
      keyframes.push({
        frame: Math.min(frame, window.end - 1),
        pose: change.pose,
        sceneIndex,
      });
    }

    if (scene.scene_type === "points" && changes.length === 0) {
      const reveals = pointsItemRevealsInSeconds[sceneIndex] ?? [];
      // Offset the acting cycle per scene so every bullet lands on a different
      // pose from the one before it (the 4-cycle + offset guarantees it).
      const poseOffset = (sceneIndex + 1) % POINTS_POSE_CYCLE.length;
      reveals.forEach((seconds, itemIndex) => {
        const frame = window.start + Math.round(seconds * fps);
        if (frame >= window.end) {
          return;
        }
        keyframes.push({
          frame,
          pose: POINTS_POSE_CYCLE[
            (itemIndex + poseOffset) % POINTS_POSE_CYCLE.length
          ],
          sceneIndex,
        });
      });
    }
  });

  return keyframes.sort((a, b) => a.frame - b.frame);
};

export type ActivePose = {
  from: PoseName;
  to: PoseName;
  framesSinceChange: number;
  sceneIndex: number;
};

/** Finds the pose pair that should be blended on a given frame. */
export const getActivePose = (
  keyframes: readonly PoseKeyframe[],
  frame: number,
): ActivePose => {
  let activeIndex = 0;
  for (let i = keyframes.length - 1; i >= 0; i--) {
    if (frame >= keyframes[i].frame) {
      activeIndex = i;
      break;
    }
  }

  const active = keyframes[activeIndex];
  const previous = keyframes[Math.max(0, activeIndex - 1)];

  return {
    from: previous.pose,
    to: active.pose,
    framesSinceChange: frame - active.frame,
    sceneIndex: active.sceneIndex,
  };
};

export type StageLayout = {
  /** Where the hip lands in composition px. */
  x: number;
  y: number;
  scale: number;
};

/**
 * Stickman placement per scene type (1080 x 1920).
 *
 * Both templates use the exact same stage so the character never changes size
 * or jumps on a cut. Hip y = 1279 puts the soles at y ~1520, which clears the
 * progress bar (>280px above the bottom edge) with room for the contact shadow.
 */
export const STAGE_LAYOUTS: Record<SceneType, StageLayout> = {
  text: { x: 540, y: 1279, scale: 1.5 },
  points: { x: 540, y: 1279, scale: 1.5 },
};

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export const mixLayout = (
  from: StageLayout,
  to: StageLayout,
  progress: number,
): StageLayout => ({
  x: lerp(from.x, to.x, progress),
  y: lerp(from.y, to.y, progress),
  scale: lerp(from.scale, to.scale, progress),
});
