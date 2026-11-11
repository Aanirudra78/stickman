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
  // emotions
  "sad_slouch",
  "angry_fists",
  "confused_scratch",
  "scared_back",
  "proud_chest",
  "excited_bounce",
  // listening / reacting
  "listening_tilt",
  "nodding",
  "tired_sigh",
  "facepalm",
  // expressive gestures
  "explaining_up",
  "counting_fingers",
  "leaning_back",
  "victory_arms",
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

  /* ---------------------------------------------------------- emotions --- */

  sad_slouch: {
    angles: {
      spine: 9,
      headTilt: 9,
      // Arms hang close to the body, hands nearly touching.
      shoulderL: -5,
      elbowL: -3,
      shoulderR: 7,
      elbowR: 5,
      hipL: -5,
      kneeL: -3,
      hipR: 5,
      kneeR: 3,
    },
    face: {
      eyeOpen: 0.6,
      happyEyes: 0,
      browLift: -0.55,
      browTilt: -0.75,
      mouthWidth: 0.8,
      mouthSmile: -0.9,
      mouthOpen: 0,
      gazeX: 0,
      gazeY: 1.4,
    },
    bobAmplitude: 2,
  },

  angry_fists: {
    angles: {
      spine: 3,
      headTilt: 2,
      // Fists clenched at the sides, elbows pulled back.
      shoulderL: -26,
      elbowL: -100,
      shoulderR: 26,
      elbowR: 100,
      hipL: -16,
      kneeL: -10,
      hipR: 16,
      kneeR: 10,
    },
    face: {
      eyeOpen: 0.9,
      happyEyes: 0,
      browLift: -0.6,
      browTilt: 1,
      mouthWidth: 1.1,
      mouthSmile: -0.8,
      mouthOpen: 0.25,
      gazeX: 0,
      gazeY: 0,
    },
    bobAmplitude: 4,
  },

  confused_scratch: {
    angles: {
      spine: -2,
      headTilt: -6,
      // Right hand up scratching the head.
      shoulderL: -12,
      elbowL: -6,
      shoulderR: 58,
      elbowR: 168,
      hipL: -7,
      kneeL: -4,
      hipR: 7,
      kneeR: 4,
    },
    face: {
      eyeOpen: 0.7,
      happyEyes: 0,
      browLift: 0.3,
      browTilt: -0.6,
      mouthWidth: 0.8,
      mouthSmile: -0.3,
      mouthOpen: 0,
      gazeX: -1.5,
      gazeY: 0.8,
    },
    bobAmplitude: 2,
  },

  scared_back: {
    angles: {
      spine: -10,
      headTilt: -5,
      // Arms up as a shield, body leaning away.
      shoulderL: -110,
      elbowL: -140,
      shoulderR: 118,
      elbowR: 150,
      hipL: -13,
      kneeL: -16,
      hipR: 14,
      kneeR: -14,
    },
    face: {
      eyeOpen: 1.5,
      happyEyes: 0,
      browLift: 0.9,
      browTilt: -0.5,
      mouthWidth: 0.7,
      mouthSmile: -0.6,
      mouthOpen: 0.7,
      gazeX: 0,
      gazeY: -0.5,
    },
    bobAmplitude: 5,
  },

  proud_chest: {
    angles: {
      spine: -6,
      headTilt: -4,
      // Hands on hips, chest out.
      shoulderL: -32,
      elbowL: -95,
      shoulderR: 32,
      elbowR: 95,
      hipL: -9,
      kneeL: -5,
      hipR: 9,
      kneeR: 5,
    },
    face: {
      eyeOpen: 0.85,
      happyEyes: 0.3,
      browLift: 0.3,
      browTilt: 0,
      mouthWidth: 1.05,
      mouthSmile: 0.75,
      mouthOpen: 0,
      gazeX: 0.5,
      gazeY: -0.5,
    },
    bobAmplitude: 3,
  },

  excited_bounce: {
    angles: {
      spine: -2,
      headTilt: -4,
      // Arms up halfway, ready to bounce.
      shoulderL: -100,
      elbowL: -130,
      shoulderR: 100,
      elbowR: 130,
      hipL: -10,
      kneeL: -6,
      hipR: 10,
      kneeR: 6,
    },
    face: {
      eyeOpen: 1.2,
      happyEyes: 0.2,
      browLift: 0.7,
      browTilt: 0,
      mouthWidth: 1.3,
      mouthSmile: 1,
      mouthOpen: 0.55,
      gazeX: 0,
      gazeY: -0.6,
    },
    bobAmplitude: 7,
  },

  /* -------------------------------------------------- listening / reacting --- */

  listening_tilt: {
    angles: {
      spine: -3,
      headTilt: -10,
      // One hand near the chin, like leaning in to hear better.
      shoulderL: -20,
      elbowL: -50,
      shoulderR: 40,
      elbowR: 110,
      hipL: -7,
      kneeL: -4,
      hipR: 7,
      kneeR: 4,
    },
    face: {
      eyeOpen: 0.9,
      happyEyes: 0,
      browLift: 0.2,
      browTilt: 0,
      mouthWidth: 0.9,
      mouthSmile: 0.25,
      mouthOpen: 0,
      gazeX: -1.2,
      gazeY: -0.6,
    },
    bobAmplitude: 2,
  },

  nodding: {
    angles: {
      spine: 0,
      headTilt: 6,
      // Relaxed, agreeing.
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
      browLift: 0.1,
      browTilt: 0,
      mouthWidth: 1,
      mouthSmile: 0.5,
      mouthOpen: 0,
      gazeX: -0.8,
      gazeY: 0,
    },
    bobAmplitude: 3,
  },

  tired_sigh: {
    angles: {
      spine: 8,
      headTilt: 8,
      // Everything hangs.
      shoulderL: -4,
      elbowL: -2,
      shoulderR: 6,
      elbowR: 4,
      hipL: -5,
      kneeL: -3,
      hipR: 5,
      kneeR: 3,
    },
    face: {
      eyeOpen: 0.5,
      happyEyes: 0,
      browLift: -0.35,
      browTilt: -0.4,
      mouthWidth: 0.7,
      mouthSmile: -0.4,
      mouthOpen: 0.15,
      gazeX: 0,
      gazeY: 1.4,
    },
    bobAmplitude: 2,
  },

  facepalm: {
    angles: {
      spine: 4,
      headTilt: 8,
      // Right hand over the face.
      shoulderL: -10,
      elbowL: -6,
      shoulderR: 55,
      elbowR: 165,
      hipL: -6,
      kneeL: -4,
      hipR: 6,
      kneeR: 4,
    },
    face: {
      eyeOpen: 0.3,
      happyEyes: 0,
      browLift: -0.4,
      browTilt: -0.5,
      mouthWidth: 0.9,
      mouthSmile: -0.5,
      mouthOpen: 0,
      gazeX: 0,
      gazeY: 1,
    },
    bobAmplitude: 2,
  },

  /* ------------------------------------------------- expressive gestures --- */

  explaining_up: {
    angles: {
      spine: -2,
      headTilt: -3,
      // Right arm raised, palm open - "here is the thing".
      shoulderL: -12,
      elbowL: -8,
      shoulderR: 95,
      elbowR: 85,
      hipL: -7,
      kneeL: -4,
      hipR: 7,
      kneeR: 4,
    },
    face: {
      eyeOpen: 1,
      happyEyes: 0,
      browLift: 0.35,
      browTilt: 0,
      mouthWidth: 1.05,
      mouthSmile: 0.45,
      mouthOpen: 0.25,
      gazeX: 1.8,
      gazeY: -1,
    },
    bobAmplitude: 3,
  },

  counting_fingers: {
    angles: {
      spine: 2,
      headTilt: 4,
      // Both hands in front, checking them off.
      shoulderL: 25,
      elbowL: 70,
      shoulderR: 40,
      elbowR: 100,
      hipL: -7,
      kneeL: -4,
      hipR: 7,
      kneeR: 4,
    },
    face: {
      eyeOpen: 0.85,
      happyEyes: 0,
      browLift: 0.15,
      browTilt: 0,
      mouthWidth: 0.95,
      mouthSmile: 0.1,
      mouthOpen: 0,
      gazeX: 1.2,
      gazeY: 1.2,
    },
    bobAmplitude: 2,
  },

  leaning_back: {
    angles: {
      spine: -8,
      headTilt: -5,
      // Relaxed, weight on the heels.
      shoulderL: -18,
      elbowL: -40,
      shoulderR: 20,
      elbowR: 45,
      hipL: -10,
      kneeL: -6,
      hipR: 10,
      kneeR: 5,
    },
    face: {
      eyeOpen: 0.8,
      happyEyes: 0,
      browLift: 0,
      browTilt: 0,
      mouthWidth: 1,
      mouthSmile: 0.2,
      mouthOpen: 0,
      gazeX: 0.4,
      gazeY: -0.3,
    },
    bobAmplitude: 2,
  },

  victory_arms: {
    angles: {
      spine: -3,
      headTilt: -6,
      // Both arms straight up in a V - the win.
      shoulderL: -140,
      elbowL: -170,
      shoulderR: 140,
      elbowR: 170,
      hipL: -12,
      kneeL: -6,
      hipR: 12,
      kneeR: 6,
    },
    face: {
      eyeOpen: 0.9,
      happyEyes: 1,
      browLift: 0.6,
      browTilt: 0,
      mouthWidth: 1.3,
      mouthSmile: 1,
      mouthOpen: 0.4,
      gazeX: 0,
      gazeY: -0.9,
    },
    bobAmplitude: 7,
  },
};

/** Poses that get a small spring overshoot when they become active. */
export const SPRING_POSES: readonly PoseName[] = [
  "pointing",
  "surprised",
  "happy",
  "excited_bounce",
  "victory_arms",
  "scared_back",
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
