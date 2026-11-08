import type { ActionId } from "./actions/types";
import type { PoseName } from "./poses/poses";
import type { PropId } from "./props/ids";

/** Composition constants. */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Fade + slide duration at each scene boundary, in frames. */
export const SCENE_TRANSITION_FRAMES = 10;

/** Video-first layout: 1080px wide => keep text away from the edges. */
export const SAFE_X = 96;
export const SAFE_TOP = 100;
export const SAFE_BOTTOM = 100;

/**
 * Light theme: the video is white-background, near-black ink.
 * Keep all colours here so the whole look can be restyled in one place.
 */
export const COLORS = {
  background: "#FFFFFF",
  /** Gentle vignette at the frame edges - kept near-white on purpose. */
  backgroundEdge: "#F3F6FA",
  text: "#0B0E14",
  muted: "#5B6675",
  accent: "#D97706",
  accentSoft: "rgba(217, 119, 6, 0.14)",
  /** Accent used for decorative glows - always light enough to stay "paper". */
  accentHalo: "rgba(217, 119, 6, 0.22)",
  accentRay: "rgba(217, 119, 6, 0.34)",
  accentTint: "rgba(217, 119, 6, 0.10)",
  /** Stickman strokes + face. */
  ink: "#11151C",
  /** Ground shadow under the character. */
  shadow: "rgba(15, 23, 42, 0.12)",
  /** Soft drop shadow around the character. */
  characterShadow: "rgba(15, 23, 42, 0.16)",
};

/**
 * Ambient backdrop palette. Every value is a low-alpha RGBA so the frame stays
 * a light-theme explainer: the modern look comes from depth and movement, not
 * from a dark background. Keep alpha this low or the pixel probes (which treat
 * lum < 170 as ink) will start seeing decoration as content.
 */
export const BACKDROP = {
  warm: "rgba(217, 119, 6, 0.13)",
  cool: "rgba(56, 189, 248, 0.11)",
  rose: "rgba(244, 114, 182, 0.07)",
  grid: "rgba(17, 21, 28, 0.16)",
  numeral: "rgba(11, 14, 20, 0.045)",
  /** Kept light: the bottom corners still need to read as paper (lum > 225). */
  vignette: "rgba(15, 23, 42, 0.045)",
  grainOpacity: 0.055,
} as const;

/**
 * Script format. This is what `public/script.json` must contain.
 *
 * Required per scene: `text`, `pose`, `scene_type`, `duration` (seconds).
 */
export type SceneType = "text" | "points";

export type PoseChange = {
  /** Seconds from the start of the scene. */
  at: number;
  pose: PoseName;
};

/** One scheduled action, starting `at` seconds into the scene. */
export type SceneAction = {
  at: number;
  /**
   * Index into the narration's word timings. When present the renderer starts
   * the action on that spoken word instead of the `at` estimate, which is what
   * makes the acting land exactly on the script.
   */
  word?: number;
  id: ActionId;
};

/** How a guest arrives when their name is mentioned. */
export type GuestEntrance = "walk" | "jump" | "magic";

/**
 * A cameo. The guest shows a name tag, reacts, and leaves - the main
 * character keeps narrating. Optional: scenes without a `guest` simply have
 * no visitor.
 */
export type SceneGuest = {
  name: string;
  /** Seconds into the scene when the guest appears. Defaults to 0.2. */
  at?: number;
  /** Word index of the name in the narration (wins over `at` when present). */
  word?: number;
  /** Seconds into the scene when the guest leaves. Defaults to near the end. */
  exit?: number;
  enter?: GuestEntrance;
  /** Optional pose override (defaults to a friendly idle). */
  pose?: PoseName;
};

export type Scene = {
  /** Headline for "text" scenes; heading for "points" scenes. `\n` = line break. */
  text: string;
  pose: PoseName;
  scene_type: SceneType;
  /**
   * Seconds. This is a MINIMUM: when the scene has a `voiceover`, the scene is
   * stretched to fit the narration (see `getSceneWindows`).
   */
  duration: number;
  /** List items - required when scene_type is "points". */
  items?: string[];
  /** Mouth toggle. Defaults to `pose === "talking"`. */
  speaking?: boolean;
  /** Optional mid-scene pose flip, blended with the same 8-frame transition. */
  pose_changes?: PoseChange[];
  /** What the character acts out. Empty/omitted = just the pose. */
  actions?: SceneAction[];
  /** Props held in the hands during this scene (max two). */
  props?: PropId[];
  /** Optional guest cameo. */
  guest?: SceneGuest;
  /**
   * Narration for this scene. Run `npm run voiceover` after changing it;
   * the generated clip is what actually gets played.
   */
  voiceover?: string;
};

export type VideoScript = {
  title?: string;
  /** Edge TTS voice for `npm run voiceover`. Defaults to `en-IN-NeerjaNeural`. */
  voice?: string;
  scenes: Scene[];
};
