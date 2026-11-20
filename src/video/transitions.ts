/**
 * Phase 5B: scene transitions.
 *
 * Eight flavours, picked deterministically from the scene's own content and
 * its role in the film. The transition runs inside SceneFrame (captions), and
 * `cutAccent` tells the top level how the whole frame should react at the cut
 * (dip to black, warm bloom, camera whip) so a cut feels like one move instead
 * of a text block sliding over a still background.
 */

import { SCENE_TRANSITION_FRAMES } from "../config";
import type { Scene } from "../config";

export type TransitionId =
  | "zoom"
  | "slide"
  | "wipe"
  | "rise"
  | "whip"
  | "iris"
  | "dip"
  | "bloom";

const CYCLE: readonly TransitionId[] = ["zoom", "slide", "wipe", "rise"];

/**
 * Transition for a scene without an explicit choice.
 *
 * - questions iris in: the lens closes on the thought before it opens again.
 * - big body actions whip: the camera snaps across, motion blur sells speed.
 * - the low point of the film dips: a beat of black before the turn.
 * - the close blooms: warm light, the film exhales.
 * - everything else cycles the four house cuts, never repeating the previous.
 */
export const pickTransition = (
  scene: Scene,
  index: number,
  total: number,
  previous?: TransitionId,
): TransitionId => {
  const trimmed = scene.text.trim();
  const lower = trimmed.toLowerCase();
  const role = total <= 1 ? 0.5 : index / (total - 1);

  const choose = (want: TransitionId): TransitionId => {
    if (want !== previous) return want;
    const alternative = CYCLE.find((id) => id !== previous) ?? "rise";
    return alternative;
  };

  if (index === 0) return "rise";
  // A question (or the scene that literally announces one) closes the lens.
  if (trimmed.includes("?") || /^the question\b/.test(lower)) return choose("iris");
  // The turn of the film: the camera snaps when the refusal lands.
  if (/not giving|refusing|refuse to/.test(lower)) return choose("whip");
  // One low beat: the frame dips through black on the way into "empty".
  if (/\b(empty|exhausted|drained)\b/.test(lower) && role > 0.35 && role < 0.62) {
    return choose("dip");
  }
  // The film exhales: warm bloom on the closing beat only.
  if (index === total - 1) return choose("bloom");

  const base = CYCLE[index % CYCLE.length];
  return base === previous ? CYCLE[(index + 1) % CYCLE.length] : base;
};

export type CutAccent = {
  /** 0..1 black veil over the whole frame (dip to black). */
  black: number;
  /** 0..1 warm flash over the whole frame (bloom). */
  flash: number;
  /** 0..1 camera whip amount. */
  whip: number;
  /** -1 left / +1 right: which way the world is thrown. */
  whipDir: number;
};

const smoothstep = (value: number): number => {
  const p = Math.min(1, Math.max(0, value));
  return p * p * (3 - 2 * p);
};

/**
 * Whole-frame accent for the cut nearest to `frame`. Boundaries live at the
 * start of every scene except the first; the accent peaks exactly on the cut
 * and fades out over SCENE_TRANSITION_FRAMES on both sides.
 */
export const cutAccent = (
  transitions: readonly TransitionId[],
  starts: readonly number[],
  frame: number,
): CutAccent => {
  let black = 0;
  let flash = 0;
  let whip = 0;
  let whipDir = 1;

  for (let index = 1; index < starts.length; index += 1) {
    const distance = Math.abs(frame - starts[index]);
    if (distance > SCENE_TRANSITION_FRAMES) continue;
    const strength = smoothstep(1 - distance / SCENE_TRANSITION_FRAMES);
    const before = transitions[index - 1];
    const after = transitions[index];

    if (before === "dip" || after === "dip") {
      black = Math.max(black, 0.72 * strength);
    }
    if (before === "bloom" || after === "bloom") {
      flash = Math.max(flash, 0.3 * strength);
    }
    if (before === "whip" || after === "whip") {
      if (strength > whip) {
        whip = strength;
        whipDir = index % 2 === 1 ? 1 : -1;
      }
    }
  }

  return { black, flash, whip, whipDir };
};
