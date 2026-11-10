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
import { VOICE_MANIFEST } from "../voice/voiceover";
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
 *
 * Karaoke: when the voice manifest has word timings for this scene and the
 * spoken word count matches the displayed tokens, words reveal exactly when
 * they are spoken and the active word bumps + underline while talking.
 */

const WORD_SPACING = 2;
const WORD_DURATION = 20;

export type WordTime = { text: string; start: number; end: number };

/** "Riya sat down" -> 3 tokens (mirrors the renderer's split() call). */
const tokensOf = (line: string): string[] => line.split(" ").filter((word) => word.length > 0);

/**
 * Word timings aligned to this scene's display text, or undefined. The voice
 * manifest stores the *spoken* line; when its tokens match the displayed
 * tokens one-for-one we can sync, anything else (rewritten or trimmed
 * captions, punctuation-only drift) keeps the original stagger.
 */
const normalizeToken = (token: string): string =>
  token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const wordTimesFor = (sceneIndex: number, text: string): readonly WordTime[] | undefined => {
  const voice = VOICE_MANIFEST.scenes.find((entry) => entry.index === sceneIndex);
  if (!voice || voice.words.length === 0) return undefined;

  const shown = text
    .split("\n")
    .flatMap((line) => tokensOf(line));
  const spoken = voice.words.map((word) => word.text);
  if (shown.length !== spoken.length) return undefined;

  const same = shown.every(
    (word, index) => normalizeToken(word) === normalizeToken(spoken[index] ?? ""),
  );
  return same ? voice.words : undefined;
};

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
  /** Index of this line's first word in the whole statement. */
  wordOffset: number;
  wordTimes?: readonly WordTime[];
}> = ({ line, lineIndex, fontSize, wordOffset, wordTimes }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = tokensOf(line);
  const synced = Boolean(wordTimes);

  // Which spoken word (global token index) is sounding right now - scene-local
  // seconds, because the sequence the scene template runs in starts at the
  // scene window and the manifest times are relative to the clip as well.
  const seconds = frame / fps;
  let activeIndex = -1;
  if (wordTimes) {
    activeIndex = wordTimes.findIndex(
      (span) => seconds >= span.start - 0.06 && seconds <= span.end + 0.2,
    );
  }
  const fallbackHighlight = synced ? -1 : longestWordIndex(words);

  return (
    <>
      {words.map((word, wordIndex) => {
        const globalIndex = wordOffset + wordIndex;
        const span = wordTimes?.[globalIndex];
        // Karaoke: a word shows up just before it is spoken. Without timings
        // the original stagger keeps its rhythm.
        const start = span
          ? Math.max(1, Math.round((span.start - 0.09) * fps))
          : 4 + lineIndex * 4 + wordIndex * WORD_SPACING;
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

        // Active-word bump while the voice is on this word, smooth in and out.
        const isHighlight = span
          ? globalIndex === activeIndex
          : wordIndex === fallbackHighlight;
        const bump = isHighlight && span
          ? Math.min(1, Math.max(0, (seconds - span.start) / 0.12)) *
            Math.min(1, Math.max(0, (span.end + 0.35 - seconds) / 0.35))
          : 0;
        const emphasis = isHighlight
          ? spring({
              frame: Math.max(0, local - 6),
              fps,
              config: { damping: 13, mass: 0.5, stiffness: 160 },
              durationInFrames: 22,
            })
          : 0;
        const draw = isHighlight
          ? (bump > 0 ? bump : 0)
          : 0;

        return (
          <span
            key={`${wordIndex}-${word}`}
            style={{
              position: "relative",
              display: "inline-block",
              opacity,
              translate: `0px ${(1 - pop) * 32}px`,
              scale: `${(0.9 + 0.1 * pop + Math.max(0, emphasis) * 0.035 + bump * 0.06).toFixed(4)}`,
              rotate: `${(1 - pop) * tilt}deg`,
              marginRight: "0.26em",
              textShadow: bump > 0 ? `0 0 ${Math.round(bump * 22)}px rgba(240, 180, 41, ${(bump * 0.55).toFixed(2)})` : undefined,
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
  /** Scene index in the script - used to pick the spoken-word timings. */
  sceneIndex?: number;
  variant?: "zoom" | "slide" | "wipe" | "rise";
  reverse?: boolean;
}> = ({ text, durationInFrames, sceneIndex, variant, reverse }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = text.split("\n");
  const wordTimes = sceneIndex === undefined ? undefined : wordTimesFor(sceneIndex, text);
  const fontSize = fitFontSize(text, { max: 108, min: 54, charWidth: 0.6 });

  let wordCursor = 0;
  const lineOffsets = lines.map((line) => {
    const offset = wordCursor;
    wordCursor += tokensOf(line).length;
    return offset;
  });

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
                wordOffset={lineOffsets[lineIndex]}
                wordTimes={wordTimes}
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
