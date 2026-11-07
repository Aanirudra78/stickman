import type { FaceParams, JointAngles } from "../poses/poses";
import type { ActionClip, ActionId, ActionKey } from "./types";

/**
 * The action library.
 *
 * Angles follow `poses.ts`: 0 = limb straight down, +90 = screen right.
 * Root offsets (`x`, `y`) are rig px (the character is ~480 px tall).
 *
 * Authoring rules:
 *   - loop clips start at `at: 0` and close at `at: 1`
 *     (the `loopClose` helper does the closing key for you)
 *   - one-shots start and end near neutral so blending in/out is invisible
 *   - `hold: true` keeps the last key until the next action
 */

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

/** A keyframe pose: joint angles and face params can be mixed in one object. */
type Poseish = Partial<JointAngles> & Partial<FaceParams>;

const K = (
  at: number,
  pose: Poseish,
  extra: Omit<ActionKey, "at" | "angles" | "face"> & {
    face?: Partial<FaceParams>;
  } = {},
): ActionKey => {
  const angles: Partial<JointAngles> = {};
  for (const key of ANGLE_KEYS) {
    if (pose[key] !== undefined) angles[key] = pose[key];
  }

  const face: Partial<FaceParams> = {};
  for (const key of FACE_KEYS) {
    if (pose[key] !== undefined) face[key] = pose[key];
  }

  return {
    at,
    angles,
    ...extra,
    face: { ...face, ...(extra.face ?? {}) },
  };
};

const loopClose = (keys: readonly ActionKey[]): ActionKey[] => [
  ...keys,
  { ...keys[0], at: 1 },
];

/** Relaxed neutral arms + legs (matches the idle pose closely). */
const N: Partial<JointAngles> = {
  spine: 0,
  headTilt: 0,
  shoulderL: -14,
  elbowL: -11,
  shoulderR: 14,
  elbowR: 11,
  hipL: -7,
  kneeL: -4,
  hipR: 7,
  kneeR: 4,
};

const FACE = {
  wide: { eyeOpen: 1.5, browLift: 1, mouthWidth: 0.6, mouthSmile: 0 },
  happy: { eyeOpen: 1, happyEyes: 1, browLift: 0.6, mouthWidth: 1.25, mouthSmile: 1 },
  sad: { eyeOpen: 0.75, browLift: -0.35, browTilt: -0.8, mouthWidth: 0.9, mouthSmile: -0.85 },
  angry: { eyeOpen: 0.95, browLift: -0.5, browTilt: 1, mouthWidth: 1.1, mouthSmile: -0.7 },
  surprised: { eyeOpen: 1.5, browLift: 1, mouthWidth: 0.6, mouthSmile: 0 },
  confused: { eyeOpen: 1, browLift: 0.35, browTilt: -1, mouthWidth: 0.85, mouthSmile: -0.2 },
  scared: { eyeOpen: 1.4, browLift: 0.9, browTilt: -0.5, mouthWidth: 0.8, mouthSmile: -0.4 },
  laugh: { eyeOpen: 1, happyEyes: 1, browLift: 0.7, mouthWidth: 1.1, mouthSmile: 1, mouthOpen: 0.8 },
} satisfies Record<string, Partial<FaceParams>>;

export const ACTION_CLIPS: Record<ActionId, ActionClip> = {
  /* ------------------------------------------------------------- movement --- */

  run: {
    id: "run",
    loop: true,
    duration: 0.5,
    keys: loopClose([
      K(
        0,
        {
          spine: 13,
          headTilt: -3,
          shoulderL: -55,
          elbowL: -80,
          shoulderR: 55,
          elbowR: 80,
          hipL: 38,
          kneeL: -10,
          hipR: -34,
          kneeR: -55,
        },
        { y: 0 },
      ),
      K(
        0.25,
        {
          spine: 13,
          shoulderL: -15,
          elbowL: -30,
          shoulderR: 15,
          elbowR: 30,
          hipL: 4,
          kneeL: -6,
          hipR: -2,
          kneeR: -34,
        },
        { y: -11 },
      ),
      K(
        0.5,
        {
          spine: 13,
          headTilt: 3,
          shoulderL: 55,
          elbowL: 80,
          shoulderR: -55,
          elbowR: -80,
          hipL: -34,
          kneeL: -55,
          hipR: 38,
          kneeR: -10,
        },
        { y: 0 },
      ),
      K(
        0.75,
        {
          spine: 13,
          shoulderL: 15,
          elbowL: 30,
          shoulderR: -15,
          elbowR: -30,
          hipL: -2,
          kneeL: -34,
          hipR: 4,
          kneeR: -6,
        },
        { y: -11 },
      ),
    ]),
  },

  walk: {
    id: "walk",
    loop: true,
    duration: 0.95,
    keys: loopClose([
      K(0, { spine: 3, shoulderL: -30, elbowL: -34, shoulderR: 34, elbowR: 38, hipL: 22, kneeL: -6, hipR: -20, kneeR: -30 }, { y: 0, x: 0 }),
      K(0.25, { spine: 3, shoulderL: -14, elbowL: -12, shoulderR: 16, elbowR: 14, hipL: 2, kneeL: -5, hipR: 0, kneeR: -14 }, { y: -5, x: 4 }),
      K(0.5, { spine: 3, shoulderL: 30, elbowL: 34, shoulderR: -30, elbowR: -34, hipL: -20, kneeL: -30, hipR: 22, kneeR: -6 }, { y: 0, x: 0 }),
      K(0.75, { spine: 3, shoulderL: 14, elbowL: 12, shoulderR: -14, elbowR: -12, hipL: 0, kneeL: -14, hipR: 2, kneeR: -5 }, { y: -5, x: -4 }),
    ]),
  },

  jump: {
    id: "jump",
    loop: false,
    duration: 1,
    keys: [
      K(0, N, { y: 0, squash: 1 }),
      K(
        0.14,
        { ...N, spine: 10, hipL: -40, kneeL: 24, hipR: 40, kneeR: -24, shoulderL: -40, elbowL: -70, shoulderR: 40, elbowR: 70 },
        { y: 22, squash: 0.86 },
      ),
      K(
        0.3,
        { spine: -4, shoulderL: -150, elbowL: -170, shoulderR: 150, elbowR: 170, hipL: -10, kneeL: -2, hipR: 10, kneeR: 2 },
        { y: -34, squash: 1.12, face: { ...FACE.wide, mouthOpen: 0.5 } },
      ),
      K(
        0.52,
        { spine: 0, shoulderL: -155, elbowL: -175, shoulderR: 155, elbowR: 175, hipL: 20, kneeL: -40, hipR: -20, kneeR: -40 },
        { y: -138, squash: 1.02 },
      ),
      K(
        0.76,
        { spine: 4, shoulderL: -110, elbowL: -120, shoulderR: 110, elbowR: 120, hipL: -16, kneeL: 0, hipR: 16, kneeR: 0 },
        { y: -50, squash: 1 },
      ),
      K(
        0.9,
        { ...N, spine: 8, hipL: -34, kneeL: 20, hipR: 34, kneeR: -20, shoulderL: -30, elbowL: -50, shoulderR: 30, elbowR: 50 },
        { y: 12, squash: 0.88 },
      ),
      K(1, N, { y: 0, squash: 1 }),
    ],
  },

  hop: {
    id: "hop",
    loop: false,
    duration: 0.8,
    keys: [
      K(0, N, { y: 0, squash: 1 }),
      K(0.12, { ...N, hipL: -24, kneeL: 14, hipR: 24, kneeR: -14 }, { y: 12, squash: 0.92 }),
      K(0.3, { ...N, shoulderL: -90, elbowL: -100, shoulderR: 90, elbowR: 100 }, { y: -56, squash: 1.06 }),
      K(0.46, N, { y: 0, squash: 0.9 }),
      K(0.62, { ...N, shoulderL: -70, elbowL: -80, shoulderR: 70, elbowR: 80 }, { y: -30, squash: 1.04 }),
      K(1, N, { y: 0, squash: 1 }),
    ],
  },

  dash: {
    id: "dash",
    loop: false,
    duration: 0.7,
    keys: [
      K(0, N, { x: 0, y: 0 }),
      K(
        0.22,
        { spine: 22, headTilt: -4, shoulderL: -80, elbowL: -90, shoulderR: -60, elbowR: -70, hipL: 44, kneeL: -14, hipR: -40, kneeR: -60 },
        { x: 8, y: 4, squash: 0.94 },
      ),
      K(
        0.55,
        { spine: 24, headTilt: -4, shoulderL: -85, elbowL: -95, shoulderR: -65, elbowR: -75, hipL: -40, kneeL: -60, hipR: 44, kneeR: -14 },
        { x: 34, y: -6, squash: 1.02 },
      ),
      K(0.8, { ...N, spine: 8 }, { x: 12, y: 0 }),
      K(1, N, { x: 0, y: 0 }),
    ],
  },

  fall: {
    id: "fall",
    loop: false,
    duration: 1.1,
    keys: [
      K(0, N, { y: 0, rot: 0 }),
      K(0.18, { ...N, spine: -12, shoulderL: -120, elbowL: -150, shoulderR: 120, elbowR: 150, hipL: 16, kneeL: -20, hipR: -16, kneeR: -20 }, { y: 12, rot: -6, face: FACE.scared }),
      K(0.55, { spine: -18, shoulderL: -140, elbowL: -165, shoulderR: 140, elbowR: 165, hipL: 30, kneeL: -46, hipR: -30, kneeR: -46 }, { y: 92, rot: -18 }),
      K(0.85, { spine: 14, shoulderL: -60, elbowL: -40, shoulderR: 60, elbowR: 40, hipL: -30, kneeL: 18, hipR: 30, kneeR: -18 }, { y: 128, rot: -8, squash: 0.86 }),
      K(1, { ...N, spine: 8 }, { y: 12, rot: 0, squash: 0.94 }),
    ],
  },

  spin: {
    id: "spin",
    loop: false,
    duration: 1,
    keys: [
      K(0, N, { rot: 0, y: 0 }),
      K(0.15, { ...N, spine: 6, hipL: -30, kneeL: 18, hipR: 30, kneeR: -18, shoulderL: -50, elbowL: -60, shoulderR: 50, elbowR: 60 }, { rot: 20, y: 14, squash: 0.94 }),
      K(0.5, { ...N, shoulderL: -120, elbowL: -140, shoulderR: 120, elbowR: 140 }, { rot: 190, y: -26, squash: 1.04 }),
      K(0.85, { ...N, spine: 4 }, { rot: 340, y: 0 }),
      K(1, N, { rot: 360, y: 0 }),
    ],
  },

  dance: {
    id: "dance",
    loop: true,
    duration: 1.15,
    keys: loopClose([
      K(0, { spine: 6, headTilt: 8, shoulderL: -120, elbowL: -150, shoulderR: 20, elbowR: 40, hipL: -12, kneeL: -6, hipR: 12, kneeR: 4 }, { x: -10, y: -4, face: FACE.happy }),
      K(0.25, { spine: 0, headTilt: 0, shoulderL: -40, elbowL: -60, shoulderR: 60, elbowR: 90, hipL: 4, kneeL: -8, hipR: -4, kneeR: -16 }, { x: 0, y: 2 }),
      K(0.5, { spine: -6, headTilt: -8, shoulderL: -20, elbowL: -40, shoulderR: 120, elbowR: 150, hipL: 12, kneeL: 4, hipR: -12, kneeR: -6 }, { x: 10, y: -4, face: FACE.happy }),
      K(0.75, { spine: 0, headTilt: 0, shoulderL: -60, elbowL: -90, shoulderR: 40, elbowR: 60, hipL: -4, kneeL: -16, hipR: 4, kneeR: -8 }, { x: 0, y: 2 }),
    ]),
  },

  crouch: {
    id: "crouch",
    loop: false,
    hold: true,
    duration: 0.8,
    keys: [
      K(0, N, { y: 0, squash: 1 }),
      K(0.5, { spine: 14, headTilt: -4, shoulderL: -30, elbowL: -50, shoulderR: 30, elbowR: 50, hipL: -46, kneeL: 26, hipR: 46, kneeR: -26 }, { y: 30, squash: 0.94 }),
      K(1, { spine: 12, headTilt: -2, shoulderL: -26, elbowL: -46, shoulderR: 26, elbowR: 46, hipL: -44, kneeL: 24, hipR: 44, kneeR: -24 }, { y: 28, squash: 0.95 }),
    ],
  },

  /* -------------------------------------------------------------- posture --- */

  sit: {
    id: "sit",
    loop: false,
    hold: true,
    duration: 0.9,
    keys: [
      K(0, N, { y: 0 }),
      K(0.6, { spine: -2, headTilt: 0, shoulderL: -50, elbowL: 30, shoulderR: 50, elbowR: -30, hipL: 74, kneeL: -96, hipR: 74, kneeR: -96 }, { y: 132, squash: 1 }),
      K(1, { spine: -3, headTilt: 1, shoulderL: -46, elbowL: 34, shoulderR: 46, elbowR: -34, hipL: 76, kneeL: -98, hipR: 76, kneeR: -98 }, { y: 136 }),
    ],
  },

  stand: {
    id: "stand",
    loop: false,
    hold: true,
    duration: 0.5,
    keys: [
      K(0, { spine: 6, hipL: 40, kneeL: -50, hipR: 40, kneeR: -50, shoulderL: -40, elbowL: -20, shoulderR: 40, elbowR: 20 }, { y: 44 }),
      K(1, N, { y: 0 }),
    ],
  },

  cross_arms: {
    id: "cross_arms",
    loop: false,
    hold: true,
    duration: 0.6,
    keys: [
      K(0, N),
      K(0.55, { ...N, spine: -2, headTilt: -2, shoulderL: -110, elbowL: 70, shoulderR: 110, elbowR: -100, browLift: 0.3, mouthSmile: -0.1 } as Partial<JointAngles>),
      K(1, { ...N, spine: -2, headTilt: -3, shoulderL: -108, elbowL: 72, shoulderR: 108, elbowR: -98 }),
    ],
  },

  hands_hips: {
    id: "hands_hips",
    loop: false,
    hold: true,
    duration: 0.55,
    keys: [
      K(0, N),
      K(0.6, { ...N, spine: -5, headTilt: -1, shoulderL: -45, elbowL: 10, shoulderR: 45, elbowR: -10, browLift: 0.5, mouthSmile: 0.5 }),
      K(1, { ...N, spine: -6, shoulderL: -44, elbowL: 12, shoulderR: 44, elbowR: -12, browLift: 0.5, mouthSmile: 0.55 }),
    ],
  },

  lean_in: {
    id: "lean_in",
    loop: false,
    hold: true,
    duration: 0.6,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: 9, headTilt: 6, shoulderL: -26, elbowL: -8, shoulderR: 26, elbowR: 8, browLift: 0.4 }),
      K(1, { ...N, spine: 10, headTilt: 7, shoulderL: -24, elbowL: -6, shoulderR: 24, elbowR: 6, browLift: 0.4 }),
    ],
  },

  shrug: {
    id: "shrug",
    loop: false,
    duration: 1,
    keys: [
      K(0, N),
      K(0.25, { ...N, spine: -3, shoulderL: -52, elbowL: -78, shoulderR: 52, elbowR: 78, browLift: 0.8, browTilt: -0.6, mouthSmile: 0 }, { y: -6 }),
      K(0.68, { ...N, spine: -3, shoulderL: -50, elbowL: -76, shoulderR: 50, elbowR: 76, browLift: 0.8, browTilt: -0.6, mouthSmile: 0 }, { y: -5 }),
      K(1, N, { y: 0 }),
    ],
  },

  /* ---------------------------------------------------------- hands / work --- */

  give: {
    id: "give",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N),
      K(0.3, { ...N, spine: 4, headTilt: 3, shoulderR: 82, elbowR: 92, browLift: 0.3 }),
      K(0.58, { ...N, spine: 5, headTilt: 3, shoulderR: 88, elbowR: 94, browLift: 0.3 }),
      K(1, N),
    ],
  },

  take: {
    id: "take",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N),
      K(0.35, { ...N, spine: 3, shoulderR: 86, elbowR: 96, browLift: 0.4 }),
      K(0.65, { ...N, spine: -2, shoulderR: 34, elbowR: 128, browLift: 0.2 }),
      K(1, N),
    ],
  },

  throw: {
    id: "throw",
    loop: false,
    duration: 0.85,
    keys: [
      K(0, N),
      K(0.2, { ...N, spine: -8, headTilt: -3, shoulderR: -40, elbowR: -62, browLift: 0.4 }),
      K(0.42, { ...N, spine: 12, headTilt: 2, shoulderR: 112, elbowR: 122, browLift: 0.5, mouthSmile: 0.4 }),
      K(0.7, { ...N, spine: 6, shoulderR: 70, elbowR: 80 }),
      K(1, N),
    ],
  },

  catch: {
    id: "catch",
    loop: false,
    duration: 0.8,
    keys: [
      K(0, N),
      K(0.25, { ...N, spine: -2, shoulderL: -80, elbowL: -90, shoulderR: 80, elbowR: 90, browLift: 0.6, eyeOpen: 1.2 } as Partial<JointAngles>),
      K(0.55, { ...N, spine: 4, shoulderL: -34, elbowL: -128, shoulderR: 34, elbowR: 128, browLift: 0.3 }),
      K(1, N),
    ],
  },

  open: {
    id: "open",
    loop: false,
    duration: 0.8,
    keys: [
      K(0, { ...N, shoulderL: -60, elbowL: 60, shoulderR: 60, elbowR: -60 }),
      K(0.55, { ...N, spine: 2, shoulderL: -90, elbowL: -90, shoulderR: 90, elbowR: 90, browLift: 0.6, mouthSmile: 0.5 }),
      K(1, N),
    ],
  },

  close: {
    id: "close",
    loop: false,
    duration: 0.8,
    keys: [
      K(0, { ...N, shoulderL: -90, elbowL: -90, shoulderR: 90, elbowR: 90 }),
      K(0.55, { ...N, spine: 2, shoulderL: -60, elbowL: 60, shoulderR: 60, elbowR: -60, browLift: -0.2, mouthSmile: -0.2 }),
      K(1, N),
    ],
  },

  push: {
    id: "push",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N, { x: 0 }),
      K(0.22, { ...N, spine: 10, shoulderL: -70, elbowL: -80, shoulderR: 70, elbowR: 80 }, { x: 2 }),
      K(0.55, { ...N, spine: 16, shoulderL: -80, elbowL: -88, shoulderR: 80, elbowR: 88, browLift: -0.2, mouthSmile: -0.2 }, { x: 22 }),
      K(0.8, { ...N, spine: 6, shoulderL: -40, elbowL: -50, shoulderR: 40, elbowR: 50 }, { x: 8 }),
      K(1, N, { x: 0 }),
    ],
  },

  pull: {
    id: "pull",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N, { x: 0 }),
      K(0.25, { ...N, spine: 6, shoulderL: -78, elbowL: -86, shoulderR: 78, elbowR: 86 }, { x: 4 }),
      K(0.6, { ...N, spine: -12, shoulderL: -40, elbowL: -124, shoulderR: 40, elbowR: 124, browLift: -0.3 }, { x: -20 }),
      K(0.85, { ...N, spine: -4, shoulderL: -30, elbowL: -100, shoulderR: 30, elbowR: 100 }, { x: -6 }),
      K(1, N, { x: 0 }),
    ],
  },

  write: {
    id: "write",
    loop: true,
    duration: 0.9,
    keys: loopClose([
      K(0, { ...N, spine: 4, headTilt: 8, shoulderL: -34, elbowL: -50, shoulderR: 46, elbowR: 112, gazeX: 1.6, gazeY: 1.6 } as Partial<JointAngles>),
      K(0.33, { ...N, spine: 4, headTilt: 7, shoulderL: -34, elbowL: -50, shoulderR: 52, elbowR: 122, gazeX: 1.8, gazeY: 1.7 }),
      K(0.66, { ...N, spine: 5, headTilt: 9, shoulderL: -34, elbowL: -50, shoulderR: 48, elbowR: 104, gazeX: 1.4, gazeY: 1.5 }),
    ]),
  },

  type: {
    id: "type",
    loop: true,
    duration: 0.55,
    keys: loopClose([
      K(0, { ...N, spine: 3, headTilt: 6, shoulderL: -40, elbowL: -58, shoulderR: 40, elbowR: 58, gazeY: 1.6 }),
      K(0.5, { ...N, spine: 3, headTilt: 7, shoulderL: -44, elbowL: -66, shoulderR: 44, elbowR: 66, gazeY: 1.8 }),
    ]),
  },

  count: {
    id: "count",
    loop: true,
    duration: 1.5,
    keys: loopClose([
      K(0, { ...N, spine: -1, headTilt: 2, shoulderR: 122, elbowR: 132, browLift: 0.5 }),
      K(0.33, { ...N, spine: -1, headTilt: 2, shoulderR: 122, elbowR: 96, browLift: 0.5 }),
      K(0.66, { ...N, spine: -1, headTilt: 2, shoulderR: 128, elbowR: 148, browLift: 0.6 }),
    ]),
  },

  build: {
    id: "build",
    loop: true,
    duration: 0.9,
    prop: "hammer",
    keys: loopClose([
      K(0, { ...N, spine: -4, headTilt: 4, shoulderL: -46, elbowL: 40, shoulderR: 140, elbowR: 150, browLift: 0.3 }),
      K(0.5, { ...N, spine: 8, headTilt: 6, shoulderL: -46, elbowL: 40, shoulderR: 58, elbowR: 76, browLift: 0.1 }),
    ]),
  },

  search: {
    id: "search",
    loop: true,
    duration: 1.8,
    prop: "magnifier",
    keys: loopClose([
      K(0, { ...N, spine: 4, headTilt: -8, shoulderR: 80, elbowR: 96, gazeX: -2.2, browLift: 0.4 }),
      K(0.5, { ...N, spine: 4, headTilt: 8, shoulderR: 84, elbowR: 92, gazeX: 2.2, browLift: 0.4 }),
    ]),
  },

  point_up: {
    id: "point_up",
    loop: false,
    hold: true,
    duration: 0.6,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: -2, headTilt: -3, shoulderR: 160, elbowR: 170, browLift: 0.7, gazeX: 0.8, gazeY: -2.4 } as Partial<JointAngles>),
      K(1, { ...N, spine: -2, shoulderR: 158, elbowR: 170, browLift: 0.7 }),
    ],
  },

  point_aside: {
    id: "point_aside",
    loop: false,
    hold: true,
    duration: 0.6,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: 2, headTilt: 6, shoulderR: 88, elbowR: 88, browLift: 0.4, gazeX: 2.3, gazeY: -0.4 } as Partial<JointAngles>),
      K(1, { ...N, spine: 2, headTilt: 6, shoulderR: 90, elbowR: 88, browLift: 0.4 }),
    ],
  },

  wave: {
    id: "wave",
    loop: true,
    duration: 0.7,
    keys: loopClose([
      K(0, { ...N, spine: 1, headTilt: 4, shoulderR: 148, elbowR: 162, browLift: 0.4, mouthSmile: 0.7 } as Partial<JointAngles>),
      K(0.5, { ...N, spine: 1, headTilt: 4, shoulderR: 148, elbowR: 132, browLift: 0.4, mouthSmile: 0.8 }),
    ]),
  },

  /* ------------------------------------------------------ money / business --- */

  hold_money: {
    id: "hold_money",
    loop: true,
    duration: 1.2,
    prop: "money",
    keys: loopClose([
      K(0, { ...N, spine: -1, headTilt: 2, shoulderR: 62, elbowR: 118, gazeX: 1.2, gazeY: 0.8, mouthSmile: 0.6 }),
      K(0.5, { ...N, spine: -2, headTilt: 1, shoulderR: 68, elbowR: 110, gazeX: 1.4, gazeY: 0.9, mouthSmile: 0.7 }),
    ]),
  },

  pay: {
    id: "pay",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N),
      K(0.3, { ...N, spine: 6, headTilt: 4, shoulderR: 80, elbowR: 92, browLift: 0.2 }),
      K(0.6, { ...N, spine: 8, headTilt: 5, shoulderR: 86, elbowR: 90, browLift: 0.1 }),
      K(1, N),
    ],
  },

  earn: {
    id: "earn",
    loop: false,
    duration: 1.15,
    keys: [
      K(0, N),
      K(0.3, { ...N, spine: 8, headTilt: 6, shoulderL: -58, elbowL: -100, shoulderR: 58, elbowR: 100, gazeY: 1.4 } as Partial<JointAngles>),
      K(0.6, { ...N, spine: -2, shoulderL: -34, elbowL: -128, shoulderR: 34, elbowR: 128, browLift: 0.6, mouthSmile: 0.6 }),
      K(0.85, { ...N, spine: -4, shoulderL: -120, elbowL: -140, shoulderR: 120, elbowR: 140 }, { y: -8, face: FACE.happy }),
      K(1, N, { y: 0 }),
    ],
  },

  save: {
    id: "save",
    loop: false,
    hold: true,
    duration: 0.9,
    prop: "shield",
    keys: [
      K(0, N),
      K(0.55, { ...N, spine: -4, headTilt: 0, shoulderL: -58, elbowL: 58, shoulderR: 58, elbowR: -58, browLift: 0.3, mouthSmile: 0.2 }),
      K(1, { ...N, spine: -5, shoulderL: -56, elbowL: 60, shoulderR: 56, elbowR: -60, browLift: 0.3, mouthSmile: 0.25 }),
    ],
  },

  invest: {
    id: "invest",
    loop: false,
    duration: 1.1,
    prop: "chart_up",
    keys: [
      K(0, N),
      K(0.3, { ...N, spine: 6, headTilt: 4, shoulderR: 58, elbowR: 120, gazeY: 1.2 }),
      K(0.65, { ...N, spine: -4, headTilt: -4, shoulderR: 128, elbowR: 122, gazeX: 1.6, gazeY: -2.2, browLift: 0.6 } as Partial<JointAngles>),
      K(1, N),
    ],
  },

  lose: {
    id: "lose",
    loop: false,
    hold: true,
    duration: 1,
    prop: "chart_down",
    keys: [
      K(0, N),
      K(0.45, { ...N, spine: 10, headTilt: 14, shoulderL: -4, elbowL: -2, shoulderR: 4, elbowR: 2, eyeOpen: 0.7, browLift: -0.5, browTilt: -0.7, mouthSmile: -0.9 } as Partial<JointAngles>),
      K(1, { ...N, spine: 11, headTilt: 15, shoulderL: -2, elbowL: 0, shoulderR: 2, elbowR: 0, eyeOpen: 0.65, browLift: -0.5, browTilt: -0.8, mouthSmile: -0.95 }),
    ],
  },

  /* ----------------------------------------------------------- daily life --- */

  eat: {
    id: "eat",
    loop: true,
    duration: 1.2,
    prop: "food",
    keys: loopClose([
      K(0, { ...N, spine: 2, headTilt: 2, shoulderR: 40, elbowR: 158, mouthOpen: 0.5 }),
      K(0.5, { ...N, spine: 3, headTilt: 3, shoulderR: 36, elbowR: 172, mouthOpen: 0.9 }),
    ]),
  },

  drink: {
    id: "drink",
    loop: true,
    duration: 1.4,
    keys: loopClose([
      K(0, { ...N, spine: 0, headTilt: 0, shoulderR: 42, elbowR: 156, mouthOpen: 0.2 }),
      K(0.5, { ...N, spine: -6, headTilt: -10, shoulderR: 40, elbowR: 172, mouthOpen: 0.7 }),
    ]),
  },

  sleep: {
    id: "sleep",
    loop: true,
    duration: 2.6,
    keys: loopClose([
      K(0, { ...N, spine: 8, headTilt: 22, shoulderL: -30, elbowL: 54, shoulderR: 30, elbowR: -54, eyeOpen: 0.04, browLift: -0.3, mouthSmile: 0.1 } as Partial<JointAngles>, { y: 2 }),
      K(0.5, { ...N, spine: 9, headTilt: 24, shoulderL: -28, elbowL: 58, shoulderR: 28, elbowR: -58, eyeOpen: 0.03, browLift: -0.35, mouthSmile: 0.1 }, { y: 5 }),
    ]),
  },

  cook: {
    id: "cook",
    loop: true,
    duration: 1.2,
    keys: loopClose([
      K(0, { ...N, spine: 6, headTilt: 8, shoulderL: -42, elbowL: -64, shoulderR: 46, elbowR: 84, gazeY: 1.8 }),
      K(0.5, { ...N, spine: 6, headTilt: 8, shoulderL: -38, elbowL: -60, shoulderR: 42, elbowR: 68, gazeY: 1.9 }),
    ]),
  },

  wash: {
    id: "wash",
    loop: true,
    duration: 0.8,
    keys: loopClose([
      K(0, { ...N, spine: 6, headTilt: 6, shoulderL: -56, elbowL: 54, shoulderR: 56, elbowR: -54, gazeY: 1.7 }),
      K(0.5, { ...N, spine: 7, headTilt: 7, shoulderL: -50, elbowL: 62, shoulderR: 50, elbowR: -62, gazeY: 1.9 }),
    ]),
  },

  drive: {
    id: "drive",
    loop: true,
    duration: 1.4,
    prop: "car",
    keys: loopClose([
      K(0, { ...N, spine: 4, headTilt: 0, shoulderL: -46, elbowL: -76, shoulderR: 46, elbowR: 76, gazeY: 0.6 }, { rot: -1.2 }),
      K(0.5, { ...N, spine: 4, headTilt: 0, shoulderL: -44, elbowL: -72, shoulderR: 48, elbowR: 80, gazeY: 0.6 }, { rot: 1.2 }),
    ]),
  },

  /* --------------------------------------------------------------- emotion --- */

  shock: {
    id: "shock",
    loop: false,
    duration: 0.9,
    keys: [
      K(0, N),
      K(
        0.16,
        { spine: -6, headTilt: -4, shoulderL: -128, elbowL: -152, shoulderR: 128, elbowR: 152, hipL: -10, kneeL: -8, hipR: 10, kneeR: 8 },
        { y: -14, face: FACE.wide },
      ),
      K(
        0.66,
        { spine: -6, headTilt: -4, shoulderL: -126, elbowL: -150, shoulderR: 126, elbowR: 150, hipL: -10, kneeL: -8, hipR: 10, kneeR: 8 },
        { y: -10, face: FACE.wide },
      ),
      K(1, N, { y: 0 }),
    ],
  },

  happy: {
    id: "happy",
    loop: true,
    duration: 1,
    keys: loopClose([
      K(0, { ...N, spine: 2, headTilt: 4, shoulderL: -118, elbowL: -146, shoulderR: 118, elbowR: 146, ...FACE.happy }, { y: 0 }),
      K(0.5, { ...N, spine: 2, headTilt: 5, shoulderL: -124, elbowL: -150, shoulderR: 124, elbowR: 150, ...FACE.happy }, { y: -14 }),
    ]),
  },

  sad: {
    id: "sad",
    loop: false,
    hold: true,
    duration: 0.8,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: 9, headTilt: 12, shoulderL: -4, elbowL: -1, shoulderR: 4, elbowR: 1, ...FACE.sad } as Partial<JointAngles>),
      K(1, { ...N, spine: 10, headTilt: 13, shoulderL: -3, elbowL: 0, shoulderR: 3, elbowR: 0, ...FACE.sad }),
    ],
  },

  cry: {
    id: "cry",
    loop: true,
    duration: 1.2,
    keys: loopClose([
      K(0, { ...N, spine: 8, headTilt: 10, shoulderL: -44, elbowL: 150, shoulderR: 44, elbowR: -150, eyeOpen: 0.55, browTilt: -1, mouthSmile: -1, mouthOpen: 0.3 } as Partial<JointAngles>, { x: -2 }),
      K(0.5, { ...N, spine: 10, headTilt: 13, shoulderL: -42, elbowL: 156, shoulderR: 42, elbowR: -156, eyeOpen: 0.45, browTilt: -1, mouthSmile: -1, mouthOpen: 0.5 }, { x: 2 }),
    ]),
  },

  laugh: {
    id: "laugh",
    loop: true,
    duration: 1,
    keys: loopClose([
      K(0, { ...N, spine: -8, headTilt: -12, shoulderL: -46, elbowL: 58, shoulderR: 46, elbowR: -58, ...FACE.laugh }, { y: 0 }),
      K(0.5, { ...N, spine: -12, headTilt: -16, shoulderL: -44, elbowL: 62, shoulderR: 44, elbowR: -62, ...FACE.laugh }, { y: -6 }),
    ]),
  },

  angry: {
    id: "angry",
    loop: true,
    duration: 0.9,
    keys: loopClose([
      K(0, { ...N, spine: -3, headTilt: -3, shoulderL: -34, elbowL: 44, shoulderR: 34, elbowR: -44, ...FACE.angry }, { x: -2 }),
      K(0.5, { ...N, spine: -5, headTilt: -5, shoulderL: -30, elbowL: 54, shoulderR: 30, elbowR: -54, ...FACE.angry }, { x: 2 }),
    ]),
  },

  scared: {
    id: "scared",
    loop: true,
    duration: 1,
    keys: loopClose([
      K(0, { ...N, spine: -14, headTilt: -6, shoulderL: -100, elbowL: -122, shoulderR: 100, elbowR: 122, ...FACE.scared } as Partial<JointAngles>, { x: -3, y: 4 }),
      K(0.5, { ...N, spine: -16, headTilt: -8, shoulderL: -104, elbowL: -126, shoulderR: 104, elbowR: 126, ...FACE.scared }, { x: 3, y: 6 }),
    ]),
  },

  confused: {
    id: "confused",
    loop: false,
    hold: true,
    duration: 1,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: -2, headTilt: 14, shoulderR: 70, elbowR: 58, ...FACE.confused } as Partial<JointAngles>),
      K(1, { ...N, spine: -2, headTilt: 15, shoulderR: 72, elbowR: 56, ...FACE.confused }),
    ],
  },

  think: {
    id: "think",
    loop: false,
    hold: true,
    duration: 1.1,
    keys: [
      K(0, N),
      K(0.7, { ...N, spine: -1, headTilt: -6, shoulderR: 24, elbowR: 198, browLift: 0.2, browTilt: -0.6, gazeX: -1.6, gazeY: -2.2 } as Partial<JointAngles>),
      K(1, { ...N, spine: -1, headTilt: -7, shoulderR: 25, elbowR: 200, browLift: 0.2, browTilt: -0.6, gazeX: -1.8, gazeY: -2.4 }),
    ],
  },

  facepalm: {
    id: "facepalm",
    loop: false,
    duration: 1,
    keys: [
      K(0, N),
      K(0.22, { ...N, spine: 4, headTilt: 8, shoulderR: 108, elbowR: 215, browLift: -0.4, mouthSmile: -0.6 } as Partial<JointAngles>),
      K(0.55, { ...N, spine: 4, headTilt: 12, shoulderR: 108, elbowR: 212, browLift: -0.4, mouthSmile: -0.7 }, { x: 2 }),
      K(0.78, { ...N, spine: 4, headTilt: 4, shoulderR: 106, elbowR: 216, browLift: -0.4, mouthSmile: -0.6 }, { x: -2 }),
      K(1, N),
    ],
  },

  proud: {
    id: "proud",
    loop: false,
    hold: true,
    duration: 1,
    keys: [
      K(0, N),
      K(0.65, { ...N, spine: -6, headTilt: -4, shoulderL: -44, elbowL: 10, shoulderR: 96, elbowR: 150, browLift: 0.7, mouthSmile: 0.9 } as Partial<JointAngles>),
      K(1, { ...N, spine: -7, headTilt: -5, shoulderL: -44, elbowL: 12, shoulderR: 98, elbowR: 152, browLift: 0.7, mouthSmile: 0.95 }),
    ],
  },

  sigh: {
    id: "sigh",
    loop: false,
    duration: 1.2,
    keys: [
      K(0, N),
      K(0.3, { ...N, spine: -2, headTilt: -2, shoulderL: -34, elbowL: -38, shoulderR: 34, elbowR: 38, browLift: 0.5 }, { y: -6 }),
      K(0.75, { ...N, spine: 8, headTilt: 10, shoulderL: -5, elbowL: -2, shoulderR: 5, elbowR: 2, browLift: -0.3, mouthSmile: -0.5 }, { y: 4 }),
      K(1, N, { y: 0 }),
    ],
  },

  /* ----------------------------------------------------------- interaction --- */

  talk_to_guest: {
    id: "talk_to_guest",
    loop: true,
    duration: 1.4,
    keys: loopClose([
      K(0, { ...N, spine: 7, headTilt: 9, shoulderR: 76, elbowR: 100, gazeX: 2.2, browLift: 0.3 }),
      K(0.5, { ...N, spine: 6, headTilt: 8, shoulderR: 70, elbowR: 88, gazeX: 2.2, browLift: 0.2 }),
    ]),
  },

  listen: {
    id: "listen",
    loop: true,
    duration: 1.4,
    keys: loopClose([
      K(0, { ...N, spine: 7, headTilt: 5, shoulderL: -22, elbowL: -8, shoulderR: 22, elbowR: 8, browLift: 0.35 }),
      K(0.5, { ...N, spine: 8, headTilt: 10, shoulderL: -22, elbowL: -8, shoulderR: 22, elbowR: 8, browLift: 0.35 }),
    ]),
  },

  nod: {
    id: "nod",
    loop: true,
    duration: 1,
    keys: loopClose([
      K(0, { ...N, headTilt: 0 }),
      K(0.5, { ...N, headTilt: 14, browLift: 0.2 }),
    ]),
  },

  explain_to_guest: {
    id: "explain_to_guest",
    loop: true,
    duration: 1.6,
    keys: loopClose([
      K(0, { ...N, spine: 7, headTilt: 8, shoulderL: 62, elbowL: 30, shoulderR: 104, elbowR: 112, gazeX: 2.2, browLift: 0.4 }),
      K(0.5, { ...N, spine: 8, headTilt: 9, shoulderL: 70, elbowL: 40, shoulderR: 96, elbowR: 100, gazeX: 2.3, browLift: 0.5 }),
    ]),
  },

  /* -------------------------------------------------------------- conflict --- */

  fight: {
    id: "fight",
    loop: true,
    duration: 0.9,
    keys: loopClose([
      K(0, { ...N, spine: 8, headTilt: -2, shoulderL: -44, elbowL: -112, shoulderR: 44, elbowR: 148, ...FACE.angry }, { x: -4 }),
      K(0.5, { ...N, spine: 10, headTilt: 2, shoulderL: -44, elbowL: -112, shoulderR: 96, elbowR: 96, ...FACE.angry }, { x: 6 }),
    ]),
  },

  /* --------------------------------------------------------------- generic --- */

  hold: {
    id: "hold",
    loop: true,
    duration: 1.2,
    keys: loopClose([
      K(0, { ...N, spine: -1, headTilt: 2, shoulderR: 64, elbowR: 116, gazeX: 1.4, gazeY: 0.6, browLift: 0.2 }),
      K(0.5, { ...N, spine: -2, headTilt: 1, shoulderR: 68, elbowR: 108, gazeX: 1.5, gazeY: 0.7, browLift: 0.25 }),
    ]),
  },
};
