import React from "react";
import {
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SAFE_X } from "../config";
import { TEXT_FONT_FAMILY } from "../fonts";
import { fitFontSize } from "./fitText";
import { SceneFrame } from "./SceneFrame";

/**
 * "points" scene template: heading + numbered list items that arrive one by
 * one.
 *
 * Item timing comes from the narration (`revealTimes`, seconds into the scene)
 * so each numbered point lands on the word that introduces it - the same times
 * drive the pose changes in the timeline. A fixed stagger is only used when a
 * scene has no narration.
 *
 * Motion: the heading wipes in from the left, each row springs up, its divider
 * draws, and a ring pulses out of the number badge.
 */

const ITEM_STAGGER = 6;
const ITEM_DURATION = 20;
const FIRST_ITEM_FRAME = 14;

const CONTENT_TOP = 232;
const KICKER_FONT = 19;
const HEADING_MAX_FONT = 86;
const ITEM_FONT = 60;
const ITEM_MAX_WIDTH = 786;
const BADGE_SIZE = 56;
const BADGE_GAP = 28;
const ROW_GAP = 34;

export const PointsScene: React.FC<{
  text: string;
  items: string[];
  /** Seconds, one per item. Falls back to a fixed stagger when omitted. */
  revealTimes?: readonly number[];
  durationInFrames: number;
  variant?: "zoom" | "slide" | "wipe" | "rise";
  reverse?: boolean;
}> = ({ text, items, revealTimes, durationInFrames, variant, reverse }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heading = interpolate(frame, [2, 14], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const underline = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 15, mass: 0.7, stiffness: 150 },
    durationInFrames: 24,
  });
  const headingFont = fitFontSize(text, {
    max: HEADING_MAX_FONT,
    min: 54,
    charWidth: 0.6,
  });

  // Emphasise the longest word of the heading (same heuristic as text scenes).
  const headingWords = text.replace(/\n/g, " ").split(" ").filter(Boolean);
  const headingHighlight = headingWords.reduce(
    (best, word, index) =>
      word.length >= headingWords[best].length ? index : best,
    0,
  );
  const headingInk = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 150 },
    durationInFrames: 22,
  });

  // The narration drives the reveal (or a fixed stagger when there is none).
  const itemStartFrame = (index: number): number => {
    const reveal = revealTimes?.[index];
    return reveal === undefined
      ? FIRST_ITEM_FRAME + index * ITEM_STAGGER
      : Math.round(reveal * fps);
  };

  return (
    <SceneFrame
      durationInFrames={durationInFrames}
      variant={variant}
      reverse={reverse}
    >
      <div
        style={{
          position: "absolute",
          left: SAFE_X,
          right: SAFE_X,
          top: CONTENT_TOP,
        }}
      >
        {/* Kicker pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 18px",
            borderRadius: 999,
            backgroundColor: COLORS.accentTint,
            border: `1px solid ${COLORS.accentSoft}`,
            opacity: heading,
            translate: `0px ${(1 - heading) * 16}px`,
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              backgroundColor: COLORS.accent,
              rotate: "45deg",
              scale: `${0.6 + 0.4 * heading}`,
            }}
          />
          <div
            style={{
              fontFamily: TEXT_FONT_FAMILY,
              fontSize: KICKER_FONT,
              fontWeight: 700,
              letterSpacing: "0.24em",
              color: COLORS.accent,
            }}
          >
            KEY POINTS
          </div>
        </div>

        {/* Heading wipes in from the left. */}
        <div
          style={{
            marginTop: 20,
            overflow: "hidden",
            clipPath: `inset(0 ${(1 - heading) * 100}% 0 0)`,
          }}
        >
          <div
            style={{
              fontFamily: TEXT_FONT_FAMILY,
              fontSize: headingFont,
              fontWeight: 800,
              lineHeight: 1.16,
              letterSpacing: "-0.025em",
              color: COLORS.text,
              translate: `0px ${(1 - heading) * 18}px`,
            }}
          >
            {headingWords.map((word, index) => (
              <span
                key={`${index}-${word}`}
                style={{
                  position: "relative",
                  display: "inline-block",
                  marginRight: "0.24em",
                  scale:
                    index === headingHighlight
                      ? `${1 + Math.max(0, headingInk) * 0.02}`
                      : undefined,
                }}
              >
                {word}
                {index === headingHighlight ? (
                  <span
                    style={{
                      position: "absolute",
                      left: "-0.03em",
                      right: "-0.03em",
                      bottom: "-0.08em",
                      height: Math.max(4, headingFont * 0.05),
                      borderRadius: 999,
                      backgroundColor: COLORS.accent,
                      transformOrigin: "left center",
                      scale: `${Math.min(1, Math.max(0, headingInk))} 1`,
                      opacity: 0.8,
                    }}
                  />
                ) : null}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            width: 128,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLORS.accent,
            transformOrigin: "left",
            scale: `${Math.min(1, Math.max(0, underline))} 1`,
          }}
        />

        {/* Numbered points */}
        <div style={{ marginTop: 44 }}>
          {items.map((item, index) => {
            const start = itemStartFrame(index);
            const local = frame - start;
            // Once the next point lands, this one steps back a little so the
            // eye always knows which line is being talked about.
            const nextStart =
              index < items.length - 1 ? itemStartFrame(index + 1) : Infinity;
            const dim = Number.isFinite(nextStart)
              ? interpolate(
                  frame,
                  [nextStart + 2, nextStart + 10],
                  [1, 0.62],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                )
              : 1;

            const rowPop = spring({
              frame: Math.max(0, local),
              fps,
              config: { damping: 16, mass: 0.7, stiffness: 150 },
              durationInFrames: ITEM_DURATION,
            });
            const opacity = interpolate(local, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const badge = spring({
              frame: Math.max(0, local),
              fps,
              config: { damping: 13, mass: 0.5, stiffness: 170 },
              durationInFrames: 18,
            });
            const divider = interpolate(local, [2, 16], [0, 1], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            // The badge ring expands once, then is gone.
            const ring = interpolate(local, [4, 24], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const isLast = index === items.length - 1;

            return (
              <div
                key={item}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: BADGE_GAP,
                  paddingBottom: isLast ? 0 : ROW_GAP,
                  marginBottom: isLast ? 0 : ROW_GAP,
                  opacity: opacity * dim,
                  translate: `0px ${(1 - rowPop) * 26}px`,
                  scale: `${0.985 + 0.015 * rowPop}`,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    flex: "0 0 auto",
                    width: BADGE_SIZE,
                    height: BADGE_SIZE,
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: BADGE_SIZE / 2,
                      border: `2.5px solid ${COLORS.accentHalo}`,
                      opacity: (1 - ring) * 0.9,
                      scale: `${1 + ring * 0.65}`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: BADGE_SIZE / 2,
                      backgroundColor: COLORS.ink,
                      color: COLORS.background,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: TEXT_FONT_FAMILY,
                      fontSize: 24,
                      fontWeight: 700,
                      scale: `${0.55 + 0.45 * badge}`,
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: TEXT_FONT_FAMILY,
                    fontSize: ITEM_FONT,
                    fontWeight: 550,
                    lineHeight: 1.32,
                    color: COLORS.text,
                    maxWidth: ITEM_MAX_WIDTH,
                  }}
                >
                  {item}
                </div>

                {!isLast ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 1.5,
                      backgroundColor: "rgba(17, 21, 28, 0.10)",
                      transformOrigin: "left",
                      scale: `${divider} 1`,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
};
