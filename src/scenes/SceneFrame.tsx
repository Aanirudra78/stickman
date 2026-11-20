import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SCENE_TRANSITION_FRAMES } from "../config";
import type { TransitionId } from "../video/transitions";

/**
 * Scene enter/exit transition. ~10 frames in, ~10 frames out, always driven by
 * the local frame the parent <Sequence> provides.
 *
 * Eight flavours are mixed across the video so every cut does not read the same:
 *   - "zoom":  a quick push-through, like a camera snap.
 *   - "slide": the block travels in from the side, outgoing continues away.
 *   - "wipe":  the scene is revealed by a hard clip edge.
 *   - "rise":  the original soft rise + settle.
 *   - "whip":  a fast lateral snap with heavy motion blur (speed cuts).
 *   - "iris":  a circular lens closes and reopens (questions).
 *   - "dip":   the frame breathes down through black (the low beat).
 *   - "bloom": warm light swells in and settles (the close).
 *
 * All of them cross-fade underneath, so the incoming and outgoing scenes are
 * never both fully opaque.
 */
export type SceneTransitionVariant = TransitionId;

export const SceneFrame: React.FC<{
  durationInFrames: number;
  variant?: SceneTransitionVariant;
  /** Flips the horizontal direction for slide/wipe. */
  reverse?: boolean;
  children: React.ReactNode;
}> = ({ durationInFrames, variant = "rise", reverse = false, children }) => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, SCENE_TRANSITION_FRAMES], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exit = interpolate(
    frame,
    [durationInFrames - SCENE_TRANSITION_FRAMES, durationInFrames],
    [1, 0],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const opacity = Math.min(enter, exit);
  const direction = reverse ? -1 : 1;

  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;
  let rotate = 0;
  let blur = (1 - opacity) * 4;
  let clipPath: string | undefined;

  switch (variant) {
    case "zoom":
      // Snap in from slightly pushed-in, drift out slightly past home.
      scale = 1 + (1 - enter) * 0.075 - (1 - exit) * 0.028;
      blur = (1 - opacity) * 6;
      break;
    case "slide":
      offsetX = (1 - enter) * 110 * direction + (1 - exit) * -80 * direction;
      rotate = ((1 - enter) * -0.5 + (1 - exit) * 0.3) * direction;
      blur = (1 - opacity) * 3.5;
      break;
    case "wipe":
      // Reveal left-to-right on entry, hide left-to-right on exit.
      clipPath = `inset(0 ${(1 - enter) * 100}% 0 0)`;
      if (exit < 1) {
        clipPath = `inset(0 0 0 ${(1 - exit) * 100}%)`;
      }
      blur = 0;
      break;
    case "rise":
    default:
      offsetY = (1 - enter) * 40 + (1 - exit) * -26;
      scale = 1 - (1 - enter) * 0.022 - (1 - exit) * 0.012;
      rotate = (1 - enter) * -0.3 + (1 - exit) * 0.22;
      blur = (1 - opacity) * 5;
      break;
    case "whip":
      // A camera whip: the block snaps in from the side with motion blur and
      // keeps travelling out the other way. Short, so it never feels like a
      // slow slide.
      offsetX = (1 - enter) * 320 * direction - (1 - exit) * 240 * direction;
      scale = 1 + (1 - enter) * 0.045;
      rotate = (1 - enter) * 1.1 * direction - (1 - exit) * 0.8 * direction;
      blur = (1 - opacity) * 16;
      break;
    case "iris":
      // Circular lens: closes onto the statement, opens again on the way out.
      clipPath = `circle(${(6 + enter * 94).toFixed(2)}% at 50% 44%)`;
      if (exit < 1) {
        clipPath = `circle(${(6 + exit * 94).toFixed(2)}% at 50% 44%)`;
      }
      scale = 1 + (1 - enter) * 0.03;
      blur = (1 - opacity) * 3;
      break;
    case "dip":
      // The frame sinks and the type dims before the cut - the low beat.
      offsetY = (1 - enter) * 24;
      scale = 1 - (1 - enter) * 0.03 - (1 - exit) * 0.02;
      blur = (1 - opacity) * 2.5;
      break;
    case "bloom":
      // Warm light swells in: brightness lifts, then settles.
      scale = 1 + (1 - enter) * 0.06 - (1 - exit) * 0.015;
      blur = (1 - opacity) * 3;
      break;
  }

  // Bloom needs a brightness lift on top of the transform; kept separate so
  // the other variants keep their crisp type.
  const brightness = variant === "bloom" ? 1 + (1 - enter) * 0.45 : 1;
  const filterParts = [
    blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "",
    brightness !== 1 ? `brightness(${brightness.toFixed(3)})` : "",
  ].filter(Boolean);

  return (
    <AbsoluteFill
      style={{
        opacity,
        translate: `${offsetX}px ${offsetY}px`,
        scale: `${scale}`,
        rotate: `${rotate}deg`,
        filter: filterParts.length > 0 ? filterParts.join(" ") : undefined,
        clipPath,
        transformOrigin: "50% 42%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
