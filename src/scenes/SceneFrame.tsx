import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { SCENE_TRANSITION_FRAMES } from "../config";

/**
 * Scene enter/exit transition. ~10 frames in, ~10 frames out, always driven by
 * the local frame the parent <Sequence> provides.
 *
 * Four flavours are mixed across the video so every cut does not read the same:
 *   - "zoom":  a quick push-through, like a camera snap.
 *   - "slide": the block travels in from the side, outgoing continues away.
 *   - "wipe":  the scene is revealed by a hard clip edge.
 *   - "rise":  the original soft rise + settle.
 *
 * All of them cross-fade underneath, so the incoming and outgoing scenes are
 * never both fully opaque.
 */
export type SceneTransitionVariant = "zoom" | "slide" | "wipe" | "rise";

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
  }

  return (
    <AbsoluteFill
      style={{
        opacity,
        translate: `${offsetX}px ${offsetY}px`,
        scale: `${scale}`,
        rotate: `${rotate}deg`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
        clipPath,
        transformOrigin: "50% 42%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
