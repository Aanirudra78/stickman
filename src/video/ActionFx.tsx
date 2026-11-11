import React from "react";
import { COLORS } from "../config";

/**
 * Body-level action FX, drawn inside the character container so they inherit
 * the same transform:
 *
 *   SpeedSmear - motion streaks trailing behind run/dash/spin.
 *   DustPuffs  - little puffs kicked up when a jump lands (progress 0..1 over
 *                the landing window).
 *
 * All coordinates are CONTAINER px: the hip sits at (HIP_X, HIP_Y), the feet
 * on the ground line at HIP_Y + 158. Streaks/puffs are drawn behind the body
 * (rendered before <Stickman>).
 */

const HIP_X = 270;
const GROUND = 458; // HIP_Y + groundY(158)

const puff = (offsetX: number, scale: number, progress: number) => {
  const grow = 0.5 + progress * 1.1;
  return (
    <div
      key={offsetX}
      style={{
        position: "absolute",
        left: HIP_X + offsetX - 20 * grow,
        top: GROUND - 18 - 6 * grow,
        width: 40 * grow * scale,
        height: 18 * grow * scale,
        borderRadius: "999px",
        backgroundColor: COLORS.accent,
        opacity: (1 - progress) * 0.5,
        filter: "blur(2px)",
      }}
    />
  );
};

export const SpeedSmear: React.FC<{ intensity: number }> = ({ intensity }) => {
  if (intensity <= 0.02) return null;
  const alpha = intensity * 0.3;
  // Three streaks trailing to the left of the body, spanning chest to thigh.
  const streak = (index: number) => {
    const w = 130 - index * 22;
    const x = 190 - index * 14;
    const y = 220 + index * 74;
    return (
      <div
        key={index}
        style={{
          position: "absolute",
          left: x - w,
          top: y - 9,
          width: w,
          height: 18,
          borderRadius: "999px",
          background: `linear-gradient(90deg, transparent 0%, ${COLORS.accent} ${Math.round(
            55 + index * 10,
          )}%, transparent 100%)`,
          opacity: alpha,
          filter: "blur(2px)",
        }}
      />
    );
  };
  return <>{[0, 1, 2].map(streak)}</>;
};

export const DustPuffs: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0 || progress >= 1) return null;
  return (
    <>
      {puff(-46, 1, progress)}
      {puff(38, 0.9, Math.max(0, progress - 0.15))}
      {puff(-4, 1.2, Math.min(1, progress + 0.1))}
    </>
  );
};
