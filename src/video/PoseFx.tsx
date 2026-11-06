import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../config";

/**
 * Decorative "energy" behind the head for the excited poses (`surprised`,
 * `happy`): a soft halo, a ring and a burst of accent rays that rotate slowly
 * and breathe. Drawn behind the character, so the filled head hides the middle
 * and only the burst reads.
 *
 * `intensity` is 0 for ordinary poses and rises to 1 as the arms go up. All
 * colours are deliberately low-alpha: the frame must stay light so the pixel
 * probes never mistake decoration for ink.
 */

const RAY_COUNT = 14;
const RAY_INNER = 62;
const RAY_LONG = 30;
const RAY_SHORT = 17;

export const PoseFx: React.FC<{
  /** Head centre in the character container's px. */
  x: number;
  y: number;
  /** 0..1 - how much of the burst to show. */
  intensity: number;
}> = ({ x, y, intensity }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  if (intensity <= 0.001) {
    return null;
  }

  const spin = t * 9;
  const pulse = 1 + Math.sin(t * Math.PI * 2 * 0.85) * 0.07;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 130,
          top: y - 130,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.accentTint} 0%, transparent 70%)`,
          opacity: intensity,
        }}
      />

      <svg
        width={320}
        height={320}
        viewBox="-160 -160 320 320"
        style={{
          position: "absolute",
          left: x - 160,
          top: y - 160,
          overflow: "visible",
          opacity: intensity,
        }}
      >
        <circle
          cx={0}
          cy={0}
          r={78}
          fill="none"
          stroke={COLORS.accentHalo}
          strokeWidth={2.5}
        />

        <g transform={`rotate(${spin})`}>
          {Array.from({ length: RAY_COUNT }, (_, index) => {
            const angle = (360 / RAY_COUNT) * index;
            const length = (index % 2 === 0 ? RAY_LONG : RAY_SHORT) * pulse;
            return (
              <line
                key={index}
                x1={0}
                y1={-RAY_INNER}
                x2={0}
                y2={-(RAY_INNER + length)}
                stroke={COLORS.accentRay}
                strokeWidth={7}
                strokeLinecap="round"
                opacity={index % 2 === 0 ? 1 : 0.65}
                transform={`rotate(${angle})`}
              />
            );
          })}
        </g>

        <circle
          cx={0}
          cy={0}
          r={104}
          fill="none"
          stroke={COLORS.accentTint}
          strokeWidth={1.5}
          strokeDasharray="3 11"
          transform={`rotate(${-spin * 0.6})`}
        />
      </svg>
    </>
  );
};
