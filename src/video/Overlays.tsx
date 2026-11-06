import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SAFE_X } from "../config";
import { TEXT_FONT_FAMILY } from "../fonts";
import type { SceneWindow } from "../timeline/timeline";

/**
 * Persistent brand furniture:
 *   - a frosted wordmark chip top-left,
 *   - a chapter counter top-right ("03 / 05"),
 *   - a segmented chapter bar at the bottom where each segment is one scene
 *     and fills with that scene's progress.
 *
 * Everything is a pure function of the frame, sits inside the safe margins,
 * and never overlaps the scene text column.
 */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const CHIP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  backgroundColor: "rgba(255, 255, 255, 0.78)",
  border: "1px solid rgba(17, 21, 28, 0.07)",
  borderRadius: 999,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
};

export const Overlays: React.FC<{
  title?: string;
  windows?: readonly SceneWindow[];
}> = ({ title, windows }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const intro = interpolate(frame, [6, 26], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = clamp(frame / Math.max(1, durationInFrames - 1), 0, 1);

  const segments = windows ?? [];
  let current = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (frame >= segments[i].start) {
      current = i;
      break;
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {title ? (
        <div
          style={{
            position: "absolute",
            left: SAFE_X,
            top: 92,
            gap: 14,
            padding: "12px 22px",
            opacity: intro,
            translate: `0px ${(1 - intro) * 10}px`,
            ...CHIP_STYLE,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: COLORS.accent,
              rotate: "45deg",
            }}
          />
          <div
            style={{
              maxWidth: 600,
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontFamily: TEXT_FONT_FAMILY,
              fontSize: 22,
              fontWeight: 650,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COLORS.muted,
            }}
          >
            {title}
          </div>
        </div>
      ) : null}

      {segments.length > 0 ? (
        <div
          style={{
            position: "absolute",
            right: SAFE_X,
            top: 92,
            gap: 6,
            padding: "12px 20px",
            fontFamily: TEXT_FONT_FAMILY,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
            opacity: intro,
            translate: `0px ${(1 - intro) * 10}px`,
            ...CHIP_STYLE,
          }}
        >
          <span style={{ color: COLORS.text, fontWeight: 750 }}>
            {String(current + 1).padStart(2, "0")}
          </span>
          <span style={{ color: "rgba(91, 102, 117, 0.45)" }}>/</span>
          <span style={{ color: COLORS.muted }}>
            {String(segments.length).padStart(2, "0")}
          </span>
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          left: SAFE_X,
          right: SAFE_X,
          // Kept high off the bottom edge so the feet, contact shadow and the
          // character (all above y=1560) never collide with the chapter bar.
          bottom: 300,
          display: "flex",
          gap: 7,
          opacity: intro,
        }}
      >
        {segments.length > 0 ? (
          segments.map((segment, index) => {
            const fill = clamp(
              (frame - segment.start) / Math.max(1, segment.durationInFrames),
              0,
              1,
            );
            const isCurrent = index === current;
            return (
              <div
                key={segment.index}
                style={{
                  flexGrow: Math.max(1, segment.durationInFrames),
                  flexBasis: 0,
                  height: 6,
                  borderRadius: 3,
                  overflow: "hidden",
                  backgroundColor: "rgba(17, 21, 28, 0.08)",
                }}
              >
                <div
                  style={{
                    width: `${fill * 100}%`,
                    height: "100%",
                    borderRadius: 3,
                    backgroundColor: isCurrent
                      ? COLORS.accent
                      : "rgba(217, 119, 6, 0.55)",
                  }}
                />
              </div>
            );
          })
        ) : (
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: "rgba(17, 21, 28, 0.09)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: COLORS.accent,
              }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
