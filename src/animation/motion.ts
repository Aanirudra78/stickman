import { Easing, interpolate, spring } from "remotion";
import { SPRING_POSES, type PoseName } from "../poses/poses";

/**
 * Frame-driven motion helpers.
 *
 * Nothing in this file uses CSS transitions/animations - every value is a
 * pure function of the current frame, so renders are deterministic.
 */

/** How long a pose change takes before the character has fully arrived. */
export const POSE_TRANSITION_FRAMES = 8;

/** Frames of "wind up" before the body swings to the new pose. */
const ANTICIPATION_FRAMES = 2;

/** How far the body pulls back (in blend units) during the wind-up. */
const ANTICIPATION_DIP = 0.09;

/** Breathing loop speed in cycles per second. */
const BREATH_HZ = 0.42;

/**
 * Eased blend between the previous pose and the new pose.
 *
 * Three beats, all frame-pure:
 *   1. a 2-frame anticipation - the body pulls slightly *away* from the new
 *      pose before committing (negative progress),
 *   2. an 8-frame eased arrival (after the wind-up),
 *   3. for `pointing`, `surprised` and `happy`, a spring overshoot so the
 *      transition lands with energy instead of stopping dead.
 *
 * The returned value can be < 0 during anticipation and > 1 while the spring
 * overshoots; `mixPose()` keeps the result a valid pose either way.
 */
export const getPoseBlend = (
  framesSincePoseChange: number,
  target: PoseName,
  fps: number,
): number => {
  const eased = interpolate(
    framesSincePoseChange,
    [ANTICIPATION_FRAMES, ANTICIPATION_FRAMES + POSE_TRANSITION_FRAMES],
    [0, 1],
    {
      easing: Easing.bezier(0.34, 0, 0.18, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Smooth 0 -> -dip -> 0 bump that peaks right before the body moves.
  const anticipation =
    -ANTICIPATION_DIP *
    Math.sin(
      Math.PI *
        Math.min(1, framesSincePoseChange / (ANTICIPATION_FRAMES * 2)),
    );

  const base = eased + anticipation;

  if (!SPRING_POSES.includes(target)) {
    return base;
  }

  const overshoot = spring({
    frame: framesSincePoseChange,
    fps,
    config: { damping: 11, mass: 0.5, stiffness: 140 },
    durationInFrames: POSE_TRANSITION_FRAMES + 10,
  });

  // Only ever add energy - never pull the pose back behind the eased blend.
  return base + Math.max(0, overshoot - eased) * 0.75;
};

/**
 * Damped follow-through after a pose change, in degrees (or any unit the caller
 * scales). Returns 0 at the pose-change frame, then oscillates and decays over
 * roughly a second - the limbs keep moving after the body has stopped.
 */
export const getPoseFollowThrough = (
  framesSincePoseChange: number,
  fps: number,
  amplitude = 1,
): number => {
  const seconds = framesSincePoseChange / fps;
  const decay = Math.exp(-seconds * 3.1);
  return Math.sin(seconds * Math.PI * 2 * 2.1) * decay * amplitude;
};

/**
 * Breathing bob in px. Never zero, so the character is alive even on `idle`.
 */
export const getBreathOffset = (
  frame: number,
  fps: number,
  amplitude: number,
): number => {
  const seconds = frame / fps;
  return Math.sin(seconds * Math.PI * 2 * BREATH_HZ) * amplitude;
};

/**
 * Deterministic blink. Eyes are wide open most of the time and close for
 * ~4 frames every ~3.2 seconds (offset so the video never starts mid-blink).
 */
export const getEyeOpenness = (frame: number, fps: number): number => {
  const period = Math.round(fps * 3.2);
  const blinkLength = Math.max(3, Math.round(fps * 0.13));
  const phase = (frame + Math.round(fps * 1.3)) % period;

  if (phase >= blinkLength) {
    return 1;
  }

  return 1 - Math.sin((phase / blinkLength) * Math.PI) * 0.95;
};

/** Mouth shapes for the fake "talking" toggle (one shape every 2 frames). */
const TALK_PATTERN = [0.95, 0.15, 0.75, 0.1, 0.85, 0.3, 0.05, 0.6];

export const getTalkingMouth = (frame: number): number =>
  TALK_PATTERN[Math.floor(frame / 2) % TALK_PATTERN.length];

/** Eased, clamped blend used for movement (position/scale) between scenes. */
export const getPlacementBlend = (framesSinceSceneStart: number): number =>
  interpolate(framesSinceSceneStart, [0, 10], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/**
 * Slow weight shift, -1..1. Layered on the spine so the body never freezes,
 * even on a held pose (the "moving hold" rule).
 */
export const getBodySway = (frame: number, fps: number): number =>
  Math.sin((frame / fps) * Math.PI * 2 * 0.235);

/**
 * Slower second layer under `getBodySway`: the weight rocks from one foot to
 * the other roughly every 7 seconds, so even a long held scene never freezes.
 */
export const getWeightShift = (frame: number, fps: number): number =>
  Math.sin((frame / fps) * Math.PI * 2 * 0.135 + 0.9);

/**
 * Where the eyes should drift for the type of content on screen: the text
 * column sits above the character in every template, so both looks tilt up,
 * with the text scenes reading slightly further right.
 */
export const TEXT_LOOK: Record<"text" | "points", { x: number; y: number }> = {
  text: { x: 0.7, y: -1.15 },
  points: { x: 0.15, y: -1.0 },
};

/** Head/arm lilt while talking - a beat, not a machine gun. */
export const getSpeechLilt = (frame: number, fps: number): number =>
  Math.sin((frame / fps) * Math.PI * 2 * 1.05 + 0.7);

/**
 * Deterministic gaze saccades: tiny eye darts every ~1.35 s. The values are
 * added to the pose's own gaze so `thinking` still looks up and `pointing`
 * still looks at the hand, but the eyes are never glassy.
 */
const GAZE_STEPS = [
  { x: 0, y: 0 },
  { x: 1.1, y: -0.3 },
  { x: 0.1, y: 0.25 },
  { x: -1.2, y: -0.45 },
  { x: 0.45, y: 0 },
] as const;

export const getGazeSaccade = (
  frame: number,
  fps: number,
): { x: number; y: number } => {
  const step = Math.max(1, Math.round(fps * 1.35));
  return GAZE_STEPS[Math.floor(frame / step) % GAZE_STEPS.length];
};

