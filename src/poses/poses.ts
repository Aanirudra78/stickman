/**
 * Pose library for the stickman.
 *
 * A pose is ONLY data: joint angles (in degrees) plus a set of numeric face
 * parameters. Nothing here knows about React, SVG, frames or scenes.
 *
 * ANGLE CONVENTION (keep this when adding poses):
 *   - 0 degrees  = limb points straight down
 *   - +90        = limb points to screen right
 *   - -90        = limb points to screen left
 *   - elbow/knee angles are ABSOLUTE (not relative to the parent limb), which
 *     makes poses readable and interpolation predictable.
 *   - `spine`: 0 = upright, + tilts torso to the right (head moves right).
 *   - `headTilt`: 0 = upright, + tilts head to the right.
 *
 * All values are plain numbers so two poses can be blended with a simple lerp
 * in `mixPose()`.
 */

export const POSE_NAMES = [
  "idle",
  "talking",
  "pointing",
  "thinking",
  "surprised",
  "happy",
] as const;

export type PoseName = (typeof POSE_NAMES)[number];

export type JointAngles = {
  spine: number;
  headTilt: number;
  shoulderL: number;
  elbowL: number;
  shoulderR: number;
  elbowR: number;
  hipL: number;
  kneeL: number;
  hipR: number;
  kneeR: number;
};

export type FaceParams = {
  /** 0 = closed, 1 = open, >1 = wide open */
  eyeOpen: number;
  /** 0 = round eyes, 1 = happy "^ ^" eyes */
  happyEyes: number;
  /** -1 = lowered, +1 = raised */
  browLift: number;
  /** -1 = inner ends up, +1 = inner ends down */
  browTilt: number;
  mouthWidth: number;
  /** -1 = frown, 0 = flat, 1 = smile */
  mouthSmile: number;
  /** 0 = closed, 1 = fully open (syllable) */
  mouthOpen: number;
  /** Eye direction in head-local px (positive = screen right / down). */
  gazeX: number;
  gazeY: number;
};

export type Pose = {
  angles: JointAngles;
  face: FaceParams;
  /** How much the breathing bob is allowed to move the body in this pose. */
  bobAmplitude: number;
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

export const POSES: Record<PoseName, Pose> = {
  idle: {
    angles: {
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
    },
    face: {
      eyeOpen: 1,
      happyEyes: 0,
      browLift: 0,
      browTilt: 0,
      mouthWidth: 1,
      mouthSmile: 0.35,
      mouthOpen: 0,
      // Straight ahead, with the tiniest downward cast.
      gazeX: 0,
      gazeY: 0.3,
    },
    bobAmplitude: 4,
  },

  talking: {
    angles: {
      spine: -1,
      headTilt: -2,
      shoulderL: -18,
      elbowL: -26,
      shoulderR: 34,
      elbowR: 96,
      hipL: -7,
      kneeL: -4,
      hipR: 7,
      kneeR: 4,
    },
    face: {
      eyeOpen: 1,
      happyEyes: 0,
      browLift: 0.15,
      browTilt: 0,
      mouthWidth: 1,
      mouthSmile: 0.3,
      // `mouthOpen` is overridden per frame by the speaking flag.
      mouthOpen: 0,
      // Talks slightly off-camera, toward the text.
      gazeX: 1.4,
      gazeY: -0.4,
    },
    bobAmplitude: 3,
  },

  pointing: {
    angles: {
      spine: 1,
      headTilt: 3,
      shoulderL: -16,
      elbowL: -26,
      shoulderR: 78,
      elbowR: 78,
      hipL: -8,
      kneeL: -5,
      hipR: 8,
      kneeR: 4,
    },
    face: {
      eyeOpen: 1,
      happyEyes: 0,
      browLift: 0.4,
      browTilt: -0.1,
      mouthWidth: 1.05,
      mouthSmile: 0.55,
      mouthOpen: 0.12,
      // Looks toward the raised hand.
      gazeX: 2.1,
      gazeY: -0.8,
    },
    bobAmplitude: 2.5,
  },

  thinking: {
    angles: {
      spine: -1,
      headTilt: -4,
      shoulderL: -12,
      elbowL: -6,
      shoulderR: 22,
      elbowR: 200,
      hipL: -6,
      kneeL: -4,
      hipR: 6,
      kneeR: 4,
    },
    face: {
      eyeOpen: 0.55,
      happyEyes: 0,
      browLift: 0.15,
      browTilt: -0.35,
      mouthWidth: 0.75,
      mouthSmile: -0.1,
      mouthOpen: 0,
      // Looks up and away while the idea forms.
      gazeX: -1.8,
      gazeY: -2.4,
    },
    bobAmplitude: 2,
  },

  surprised: {
    angles: {
      spine: -4,
      headTilt: -3,
      // Upper arms swing OUT past the head, forearms point up: a clear V.
      // (Keeping the elbow outside the head silhouette is what stops the
      // arms from curling over the head like a hood.)
      shoulderL: -125,
      elbowL: -150,
      shoulderR: 125,
      elbowR: 150,
      hipL: -10,
      kneeL: -8,
      hipR: 10,
      kneeR: 8,
    },
    face: {
      eyeOpen: 1.5,
      happyEyes: 0,
      browLift: 1,
      browTilt: 0,
      // Narrow + tall = a clear "O" of surprise.
      mouthWidth: 0.55,
      mouthSmile: 0,
      mouthOpen: 0.95,
      // Dead ahead: surprise should hit the viewer.
      gazeX: 0,
      gazeY: 0,
    },
    bobAmplitude: 5,
  },

  happy: {
    angles: {
      spine: 2,
      headTilt: 5,
      // Same V as `surprised`, a touch wider/lower (the face sells the joy).
      shoulderL: -115,
      elbowL: -145,
      shoulderR: 115,
      elbowR: 145,
      hipL: -8,
      kneeL: -3,
      hipR: 8,
      kneeR: 3,
    },
    face: {
      eyeOpen: 1,
      happyEyes: 1,
      browLift: 0.5,
      browTilt: 0,
      mouthWidth: 1.2,
      mouthSmile: 1,
      // Closed mouth so the smile arc stays a clean arc.
      mouthOpen: 0,
      gazeX: 0.3,
      gazeY: -0.7,
    },
    bobAmplitude: 6,
  },
};

/** Poses that get a small spring overshoot when they become active. */
export const SPRING_POSES: readonly PoseName[] = [
  "pointing",
  "surprised",
  "happy",
];

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

/**
 * Blend two poses. `progress` may exceed 1 (spring overshoot) - the result is
 * still a valid pose and settles back once the spring converges.
 */
export const mixPose = (
  from: Pose,
  to: Pose,
  progress: number,
): { angles: JointAngles; face: FaceParams; bobAmplitude: number } => {
  const angles = {} as JointAngles;
  for (const key of ANGLE_KEYS) {
    angles[key] = lerp(from.angles[key], to.angles[key], progress);
  }

  const face = {} as FaceParams;
  for (const key of FACE_KEYS) {
    face[key] = lerp(from.face[key], to.face[key], progress);
  }

  return {
    angles,
    face,
    bobAmplitude: lerp(from.bobAmplitude, to.bobAmplitude, progress),
  };
};
