/**
 * Phase 5A: camera language.
 *
 * Every scene plays in one of five shot types and one of five camera moves.
 * Both are deterministic: an explicit per-scene choice (from the studio UI)
 * wins, otherwise a rule based on the scene's role in the film picks one.
 *
 * The rig is applied to the WORLD layer only (background + character), never
 * the captions - captions stay pixel-crisp and keep the contrast contract.
 */

export type ShotId = "wide" | "medium" | "close" | "low" | "high";
export type CameraMove = "push" | "pull" | "hold" | "pan" | "tilt";

export const SHOT_IDS: readonly ShotId[] = [
  "wide",
  "medium",
  "close",
  "low",
  "high",
];

export const CAMERA_MOVES: readonly CameraMove[] = [
  "push",
  "pull",
  "hold",
  "pan",
  "tilt",
];

export type Shot = {
  /** Base zoom: 1 = the frame exactly, >1 = tighter. */
  scale: number;
  /** Transform origin in % of the frame. */
  originX: number;
  originY: number;
  /** Static tilt that sells low/high angles, degrees. */
  tilt: number;
};

/**
 * Framing table. The stage sits around y 55-70% of the frame, the head around
 * y 46-52%, so a "close" frames the head and a "wide" keeps the full body with
 * breathing room above.
 */
export const SHOTS: Record<ShotId, Shot> = {
  wide: { scale: 1.0, originX: 50, originY: 56, tilt: 0 },
  medium: { scale: 1.1, originX: 50, originY: 58, tilt: 0 },
  close: { scale: 1.24, originX: 50, originY: 64, tilt: -1.1 },
  /** Camera low, looking up: origin near the feet, world tilts back. */
  low: { scale: 1.14, originX: 50, originY: 82, tilt: 2.0 },
  /** Camera high, looking down: origin near the head, gentle forward tilt. */
  high: { scale: 1.12, originX: 50, originY: 28, tilt: -2.0 },
};

/**
 * Shot for a scene without an explicit choice. Deterministic: questions and
 * the closing beat get close-ups, the opening gets a wide, everything else
 * cycles through the table so no two shots in a row repeat.
 */
export const pickShot = (
  scene: { text: string; guest?: unknown },
  index: number,
  total: number,
): ShotId => {
  const trimmed = scene.text.trim();
  const question = trimmed.endsWith("?");
  const role = total <= 1 ? 0.5 : index / (total - 1);

  if (index === 0) return "medium";
  if (question) return "close";
  if (scene.guest) return "medium";
  if (role > 0.86) return "close";
  if (role < 0.1) return "wide";

  const pattern: readonly ShotId[] = [
    "medium",
    "wide",
    "close",
    "medium",
    "low",
    "wide",
    "high",
    "medium",
  ];
  return pattern[index % pattern.length];
};

/** Camera move for a scene without an explicit choice. */
export const pickMove = (shot: ShotId, index: number): CameraMove => {
  switch (shot) {
    case "close":
      return "push";
    case "low":
      return "tilt";
    case "high":
      return "pull";
    case "wide":
      return index % 2 === 1 ? "pan" : "hold";
    default:
      return index % 3 === 1 ? "pull" : "push";
  }
};

const smoothstep = (value: number): number => {
  const p = Math.min(1, Math.max(0, value));
  return p * p * (3 - 2 * p);
};

export type CameraRig = {
  /** Final zoom to apply to the world layer. */
  scale: number;
  /** Horizontal/vertical drift in px, applied before the zoom. */
  x: number;
  y: number;
  /** World tilt in degrees (low/high angles + move accent). */
  rotate: number;
};

/**
 * Evaluate a shot + move at scene progress 0..1. Slow in / slow out via
 * smoothstep; gains are deliberately small so captions and the stage stay put.
 */
export const cameraRig = (
  shot: ShotId,
  move: CameraMove,
  progress: number,
): CameraRig => {
  const base = SHOTS[shot];
  const p = smoothstep(progress);
  let scale = base.scale;
  let x = 0;
  let y = 0;
  let rotate = base.tilt;

  switch (move) {
    case "push":
      // A continuous, gentle push-in - the "camera never stops" rule.
      scale = base.scale * (1 + 0.055 * p);
      y = -6 * p;
      break;
    case "pull":
      scale = base.scale * (1.06 - 0.06 * p);
      y = 4 * p;
      break;
    case "pan":
      // Slight overscan so the pan never reveals the frame edge.
      scale = base.scale * 1.03;
      x = (p - 0.5) * 34;
      rotate += (p - 0.5) * 0.6;
      break;
    case "tilt":
      scale = base.scale * 1.03;
      y = (p - 0.5) * 44;
      break;
    case "hold":
    default:
      break;
  }

  return { scale, x, y, rotate };
};
