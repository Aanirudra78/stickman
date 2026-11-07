import type { FaceParams, JointAngles } from "../poses/poses";
import type { PropId } from "../props/ids";

/**
 * Action clips - the "what is the character doing" layer.
 *
 * A clip is pure data: a handful of keyframes in rig units. It is sampled by
 * `sampleAction()` and blended *over* the pose by the video component, so a
 * pose (talking / pointing / thinking...) keeps providing the baseline while
 * an action (jump / run / give...) drives the interesting part.
 *
 * Keyframes only need the joints they care about: a key that omits `hipL`
 * leaves the left hip on its previous track, so sparse upper-body clips stay
 * short and readable.
 */

export const ACTION_IDS = [
  // movement
  "run",
  "walk",
  "jump",
  "hop",
  "dash",
  "fall",
  "spin",
  "dance",
  "crouch",
  // posture
  "sit",
  "stand",
  "cross_arms",
  "hands_hips",
  "lean_in",
  "shrug",
  // hands / work
  "give",
  "take",
  "throw",
  "catch",
  "open",
  "close",
  "push",
  "pull",
  "write",
  "type",
  "count",
  "build",
  "search",
  "point_up",
  "point_aside",
  "wave",
  // money / business
  "hold_money",
  "pay",
  "earn",
  "save",
  "invest",
  "lose",
  // daily life
  "eat",
  "drink",
  "sleep",
  "cook",
  "wash",
  "drive",
  // emotion
  "shock",
  "happy",
  "sad",
  "cry",
  "laugh",
  "angry",
  "scared",
  "confused",
  "think",
  "facepalm",
  "proud",
  "sigh",
  // interaction
  "talk_to_guest",
  "listen",
  "nod",
  "explain_to_guest",
  // conflict + generic prop hold (fallback)
  "fight",
  "hold",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type ActionKey = {
  /** 0..1 through the clip. */
  at: number;
  angles?: Partial<JointAngles>;
  face?: Partial<FaceParams>;
  /** Whole-body offset in rig px (positive y = down). */
  x?: number;
  y?: number;
  /** Whole-body rotation in degrees. */
  rot?: number;
  /** 1 = no squash; apply vertical scale (and inverse horizontal scale). */
  squash?: number;
  /** Show this prop while the clip is active (null = keep scene props). */
  prop?: PropId | null;
};

export type ActionClip = {
  id: ActionId;
  /** Loops for as long as the action is active. Otherwise plays once. */
  loop: boolean;
  /** Seconds for one pass (or one loop). */
  duration: number;
  /** Keep the last keyframe until the next action starts (sitting, pointing). */
  hold?: boolean;
  /** Prop that belongs to this action (hammer for `build`, ...). */
  prop?: PropId;
  keys: ActionKey[];
};

export type ActionSample = {
  angles: Partial<JointAngles>;
  face: Partial<FaceParams>;
  x: number;
  y: number;
  rot: number;
  squash: number;
  prop: PropId | null | undefined;
};

export const isActionId = (value: unknown): value is ActionId =>
  typeof value === "string" && (ACTION_IDS as readonly string[]).includes(value);
