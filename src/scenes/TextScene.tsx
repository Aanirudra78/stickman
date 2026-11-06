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
 * "text" scene template: one big editorial statement above the character.
 * Words pop in with a spring and a small stagger. Splitting happens on
 * spaces/newlines only, so Devanagari conjuncts never get cut apart.
 *
 * Hierarchy: first line is the headline (ink), any following line is the
 * payoff (accent), both auto-sized to the safe column. A faint orbit ring
 * behind the block adds depth without competing with the type.
 */

const WORD_SPACING = 2;
const WORD_DURATION = 20;

/**
 * Splits a line into words and finds the one that should get the emphasis
 * treatment (longest word; ties resolve to the last one). Pure content
 * heuristic - it never changes the script itself.
 */
const longestWordIndex = (words: readonly string[]): number =>
  words.reduce(
    (best, word, index) => (word.length >= words[best].length ? index : best),
    0,
  );

const AnimatedWords: React.FC<{
  line: string;
  lineIndex: number;
  fontSize: number;
}> = ({ line, lineIndex, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = line.split(" ").filter((word) => word.length > 0);
  const highlightIndex = longestWordIndex(words);

  return (
    <>
      {words.map((word, wordIndex) => {
        const start = 4 + lineIndex * 4 + wordIndex * WORD_SPACING;
        const local = frame - start;
        const pop = spring({
          frame: Math.max(0, local),
          fps,
          config: { damping: 15, mass: 0.6, stiffness: 190 },
          durationInFrames: WORD_DURATION,
        });
        const opacity = interpolate(local, [0, 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const tilt = wordIndex % 2 === 0 ? -2.4 : 2.4;
        const isHighlight = wordIndex === highlightIndex;

        // The emphasised word pops a touch harder and then draws its underline.
        const emphasis = isHighlight
          ? spring({
              frame: Math.max(0, local - 6),
              fps,
              config: { damping: 13, mass: 0.5, stiffness: 160 },
              durationInFrames: 22,
            })
          : 0;
        const draw = isHighlight
          ? interpolate(local - 8, [0, 13], [0, 1], {
              easing: Easing.out(Easing.cubic),
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;

        return (
          <span
            key={`${wordIndex}-${word}`}
            style={{
              position: "relative",
              display: "inline-block",
              opacity,
              translate: `0px ${(1 - pop) * 32}px`,
              scale: `${0.9 + 0.1 * pop + Math.max(0, emphasis) * 0.035}`,
              rotate: `${(1 - pop) * tilt}deg`,
              marginRight: "0.26em",
            }}
          >
            {word}
            {isHighlight ? (
              <span
                style={{
                  position: "absolute",
                  left: "-0.04em",
                  right: "-0.04em",
                  bottom: "-0.1em",
                  height: Math.max(4, fontSize * 0.055),
                  borderRadius: 999,
                  backgroundColor: COLORS.accent,
                  transformOrigin: "left center",
                  scale: `${draw} 1`,
                  opacity: 0.85,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
};

export const TextScene: React.FC<{
  text: string;
  durationInFrames: number;
  variant?: "zoom" | "slide" | "wipe" | "rise";
  reverse?: boolean;
}> = ({ text, durationInFrames, variant, reverse }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = text.split("\n");
  const fontSize = fitFontSize(text, { max: 108, min: 54, charWidth: 0.6 });

  const rule = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 16, mass: 0.7, stiffness: 140 },
    durationInFrames: 26,
  });

  const ringIn = interpolate(frame, [0, 22], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame
      durationInFrames={durationInFrames}
      variant={variant}
      reverse={reverse}
    >
      {/* Faint orbit ring behind the statement. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 545,
          width: 720,
          height: 720,
          marginLeft: -360,
          marginTop: -360,
          borderRadius: "50%",
          border: `1.5px solid ${COLORS.accentHalo}`,
          opacity: ringIn * 0.75,
          scale: `${0.92 + 0.08 * ringIn}`,
          rotate: `${frame * 0.16}deg`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -7,
            width: 14,
            height: 14,
            marginLeft: -7,
            borderRadius: "50%",
            backgroundColor: COLORS.accentTint,
            border: `2px solid ${COLORS.accentHalo}`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: SAFE_X,
          right: SAFE_X,
          top: 250,
          height: 560,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Accent rule above the statement. */}
        <div
          style={{
            width: 96,
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.accent,
            transformOrigin: "center",
            scale: `${Math.min(1, Math.max(0, rule))} 1`,
            marginBottom: 46,
          }}
        />

        <div
          style={{
            fontFamily: TEXT_FONT_FAMILY,
            fontSize,
            fontWeight: 800,
            lineHeight: 1.18,
            letterSpacing: "-0.025em",
            textAlign: "center",
            maxWidth: "100%",
          }}
        >
          {lines.map((line, lineIndex) => (
            <div
              key={lineIndex}
              style={{
                color: lineIndex === 0 ? COLORS.text : COLORS.accent,
              }}
            >
              <AnimatedWords
                line={line}
                lineIndex={lineIndex}
                fontSize={fontSize}
              />
            </div>
          ))}
        </div>

        {/* Hairline + diamond: a quiet full-stop under the statement. */}
        <div
          style={{
            marginTop: 52,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: Math.min(1, Math.max(0, rule)),
            translate: `0px ${(1 - Math.min(1, Math.max(0, rule))) * 12}px`,
          }}
        >
          <div
            style={{
              width: 92,
              height: 1.5,
              backgroundColor: "rgba(17, 21, 28, 0.18)",
            }}
          />
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              backgroundColor: COLORS.accent,
              rotate: "45deg",
            }}
          />
          <div
            style={{
              width: 92,
              height: 1.5,
              backgroundColor: "rgba(17, 21, 28, 0.18)",
            }}
          />
        </div>
      </div>
    </SceneFrame>
  );
};
