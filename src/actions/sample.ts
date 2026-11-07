import type { FaceParams, JointAngles } from "../poses/poses";
import type { PropId } from "../props/ids";
import { ACTION_CLIPS } from "./library";
import type { ActionClip, ActionId, ActionKey, ActionSample } from "./types";

/**
 * Sampling + scheduling for action clips.
 *
 * Clips are normalised once at module load (sorted keys, closed loops) into
 * per-channel tracks, so the hot path is a handful of linear interpolations
 * per frame.
 */

type Track = { at: number; value: number }[];

type PropTrack = { at: number; value: PropId | null }[];

type NormalizedClip = {
  clip: ActionClip;
  angles: Partial<Record<keyof JointAngles, Track>>;
  face: Partial<Record<keyof FaceParams, Track>>;
  x: Track;
  y: Track;
  rot: Track;
  squash: Track;
  prop: PropTrack;
};

const ANGLE_KEYS: (keyof JointAngles)[] = [
  "spine",
  "headTilt",
  "shoulderL",
  "elbowL",
  "shoulderR",
  "elbowR",
  "hipL",
  "kneeL",
  "hipR",
  "kneeR",
];

const FACE_KEYS: (keyof FaceParams)[] = [
  "eyeOpen",
  "happyEyes",
  "browLift",
  "browTilt",
  "mouthWidth",
  "mouthSmile",
  "mouthOpen",
  "gazeX",
  "gazeY",
];

const pushTrack = (track: Track, at: number, value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return;
  track.push({ at, value });
};

/** Sorted keys with a key at 0 and (for loops) a closing key at 1. */
const normalizeKeys = (clip: ActionClip): ActionKey[] => {
  const keys = [...clip.keys].sort((a, b) => a.at - b.at);
  if (keys.length === 0) keys.push({ at: 0 });
  if (keys[0].at > 0) keys.unshift({ ...keys[0], at: 0 });
  if (clip.loop && keys[keys.length - 1].at < 1) {
    keys.push({ ...keys[0], at: 1 });
  }
  return keys;
};

const normalize = (clip: ActionClip): NormalizedClip => {
  const keys = normalizeKeys(clip);

  const angles: NormalizedClip["angles"] = {};
  const face: NormalizedClip["face"] = {};
  const x: Track = [];
  const y: Track = [];
  const rot: Track = [];
  const squash: Track = [];
  const prop: PropTrack = [];

  for (const key of keys) {
    for (const joint of ANGLE_KEYS) {
      const track = (angles[joint] ??= []);
      pushTrack(track, key.at, key.angles?.[joint]);
    }
    for (const channel of FACE_KEYS) {
      const track = (face[channel] ??= []);
      pushTrack(track, key.at, key.face?.[channel]);
    }
    pushTrack(x, key.at, key.x);
    pushTrack(y, key.at, key.y);
    pushTrack(rot, key.at, key.rot);
    pushTrack(squash, key.at, key.squash);
    if (key.prop !== undefined) prop.push({ at: key.at, value: key.prop });
  }

  return { clip, angles, face, x, y, rot, squash, prop };
};

const NORMALIZED = new Map<ActionId, NormalizedClip>(
  (Object.keys(ACTION_CLIPS) as ActionId[]).map((id) => [
    id,
    normalize(ACTION_CLIPS[id]),
  ]),
);

/** Linear sample of a value track. */
const trackValue = (track: Track, t: number, fallback: number): number => {
  if (track.length === 0) return fallback;
  if (t <= track[0].at) return track[0].value;

  for (let i = 1; i < track.length; i++) {
    if (t <= track[i].at) {
      const a = track[i - 1];
      const b = track[i];
      const span = b.at - a.at || 1;
      return a.value + (b.value - a.value) * ((t - a.at) / span);
    }
  }

  return track[track.length - 1].value;
};

const propValue = (
  track: PropTrack,
  t: number,
): PropId | null | undefined => {
  let value: PropId | null | undefined;
  for (const entry of track) {
    if (entry.at <= t) value = entry.value;
    else break;
  }
  return value;
};

/** Samples one clip at `seconds` (clamped for one-shots, wrapped for loops). */
export const sampleAction = (id: ActionId, seconds: number): ActionSample => {
  const normalized = NORMALIZED.get(id);
  if (!normalized) {
    return {
      angles: {},
      face: {},
      x: 0,
      y: 0,
      rot: 0,
      squash: 1,
      prop: undefined,
    };
  }

  const { clip } = normalized;
  const raw = clip.duration > 0 ? seconds / clip.duration : 1;
  const t = clip.loop
    ? ((raw % 1) + 1) % 1
    : Math.min(1, Math.max(0, raw));

  const angles: Partial<JointAngles> = {};
  for (const joint of ANGLE_KEYS) {
    const track = normalized.angles[joint];
    if (track && track.length > 0) {
      angles[joint] = trackValue(track, t, 0);
    }
  }

  const face: Partial<FaceParams> = {};
  for (const channel of FACE_KEYS) {
    const track = normalized.face[channel];
    if (track && track.length > 0) {
      face[channel] = trackValue(track, t, 0);
    }
  }

  return {
    angles,
    face,
    x: trackValue(normalized.x, t, 0),
    y: trackValue(normalized.y, t, 0),
    rot: trackValue(normalized.rot, t, 0),
    squash: trackValue(normalized.squash, t, 1),
    prop: propValue(normalized.prop, t),
  };
};

/* --------------------------------------------------------------- schedule --- */

export type ScheduledAction = { at: number; id: ActionId };

export type ActiveAction = {
  id: ActionId;
  clip: ActionClip;
  /** Seconds since the action started. */
  elapsed: number;
  /** 0..1 blend over the pose. */
  weight: number;
};

const FADE_IN_SECONDS = 0.16;
const FADE_OUT_SECONDS = 0.22;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Which action owns the current frame, and how strongly.
 *
 * - loop/hold clips stay until the next scheduled action
 * - one-shots fade out after their last key; if nothing else is playing the
 *   scene falls back to the pose
 */
export const getActiveAction = (
  actions: readonly ScheduledAction[] | undefined,
  localSeconds: number,
): ActiveAction | null => {
  if (!actions || actions.length === 0) return null;

  for (let i = actions.length - 1; i >= 0; i--) {
    const entry = actions[i];
    const clip = ACTION_CLIPS[entry.id];
    if (!clip) continue;

    const elapsed = localSeconds - entry.at;
    if (elapsed < 0) continue;

    const survives = clip.loop || clip.hold;
    if (!survives && elapsed > clip.duration + FADE_OUT_SECONDS) continue;

    const fadeIn = clamp01(elapsed / FADE_IN_SECONDS);
    const fadeOut = survives
      ? 1
      : 1 - clamp01((elapsed - clip.duration) / FADE_OUT_SECONDS);

    return {
      id: entry.id,
      clip,
      elapsed,
      weight: Math.min(fadeIn, fadeOut),
    };
  }

  return null;
};

/** Merges an action sample over a set of pose angles / face params. */
export const blendAction = (
  angles: JointAngles,
  face: FaceParams,
  sample: ActionSample,
  weight: number,
): { angles: JointAngles; face: FaceParams } => {
  if (weight <= 0) return { angles, face };

  const outAngles = { ...angles };
  for (const joint of ANGLE_KEYS) {
    const value = sample.angles[joint];
    if (value === undefined) continue;
    outAngles[joint] = outAngles[joint] + (value - outAngles[joint]) * weight;
  }

  const outFace = { ...face };
  for (const channel of FACE_KEYS) {
    const value = sample.face[channel];
    if (value === undefined) continue;
    outFace[channel] = outFace[channel] + (value - outFace[channel]) * weight;
  }

  return { angles: outAngles, face: outFace };
};
