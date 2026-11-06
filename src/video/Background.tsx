import React from "react";
import {
  AbsoluteFill,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BACKDROP, COLORS } from "../config";
import { TEXT_FONT_FAMILY } from "../fonts";

/**
 * Persistent background system.
 *
 * Everything is frame-driven (no CSS animation): three soft colour fields drift
 * on slow sine paths, a dot grid parallaxes, faint orbit rings rotate, a ghost
 * chapter numeral rises on each scene change, and a fine grain tile keeps the
 * white from looking flat.
 *
 * All layers stay in the light end of the range on purpose: the video is still
 * a white-theme explainer, just with depth instead of a dead flat fill.
 */

const Blob: React.FC<{
  color: string;
  size: number;
  x: number;
  y: number;
}> = ({ color, size, x, y }) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
    }}
  />
);

/** Thin editorial ring with a small travelling accent dot. */
const OrbitRing: React.FC<{
  size: number;
  x: number;
  y: number;
  rotate: number;
  opacity: number;
}> = ({ size, x, y, rotate, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: "50%",
      border: `1.5px solid ${COLORS.accentHalo}`,
      opacity,
      rotate: `${rotate}deg`,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: -6,
        width: 12,
        height: 12,
        marginLeft: -6,
        borderRadius: "50%",
        backgroundColor: COLORS.accentTint,
      }}
    />
  </div>
);

export const Background: React.FC<{
  sceneIndex: number;
  sceneStart: number;
}> = ({ sceneIndex, sceneStart }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Slow, irrational-ish periods so the layers never visibly loop together.
  const amber = {
    x: 300 + Math.sin(t * 0.13) * 80,
    y: 620 + Math.cos(t * 0.09) * 110,
  };
  const cool = {
    x: 840 + Math.cos(t * 0.07 + 1.2) * 90,
    y: 1080 + Math.sin(t * 0.11 + 0.4) * 120,
  };
  const rose = {
    x: 190 + Math.sin(t * 0.08 + 2.1) * 70,
    y: 1480 + Math.cos(t * 0.1 + 0.8) * 90,
  };

  const gridX = Math.sin(t * 0.05) * 18;
  const gridY = Math.cos(t * 0.04) * 14;

  const numeralIn = interpolate(frame - sceneStart, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const numeral = String(sceneIndex + 1).padStart(2, "0");

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {/* Base wash: warm top, cool bottom. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(168deg, ${COLORS.background} 0%, #F8FAFD 52%, ${COLORS.backgroundEdge} 100%)`,
        }}
      />

      {/* Drifting colour fields. */}
      <Blob color={BACKDROP.warm} size={900} x={amber.x} y={amber.y} />
      <Blob color={BACKDROP.cool} size={780} x={cool.x} y={cool.y} />
      <Blob color={BACKDROP.rose} size={640} x={rose.x} y={rose.y} />

      {/* Dot grid: parallax depth without a hard pattern. */}
      <div
        style={{
          position: "absolute",
          inset: -80,
          backgroundImage: `radial-gradient(circle, ${BACKDROP.grid} 1.1px, transparent 1.3px)`,
          backgroundSize: "54px 54px",
          opacity: 0.18,
          translate: `${gridX}px ${gridY}px`,
        }}
      />

      {/* A pair of faint orbit rings frames the lower stage. */}
      <OrbitRing
        size={980}
        x={40}
        y={1320}
        rotate={t * 5}
        opacity={0.55}
      />
      <OrbitRing
        size={820}
        x={1050}
        y={1700}
        rotate={-t * 4}
        opacity={0.4}
      />

      {/* Ghost chapter numeral - gives each scene a place in the film. */}
      <div
        style={{
          position: "absolute",
          right: -28,
          top: 118,
          fontFamily: TEXT_FONT_FAMILY,
          fontSize: 380,
          fontWeight: 800,
          lineHeight: 0.8,
          letterSpacing: "-0.07em",
          color: BACKDROP.numeral,
          opacity: numeralIn,
          translate: `0px ${(1 - numeralIn) * 26 + Math.sin(t * 0.08) * 6}px`,
          scale: `${0.97 + 0.03 * numeralIn}`,
        }}
      >
        {numeral}
      </div>

      {/* Fine grain: static tile, so it never shimmers between frames. */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile("textures/grain.png")})`,
          backgroundRepeat: "repeat",
          opacity: BACKDROP.grainOpacity,
          mixBlendMode: "multiply",
        }}
      />

      {/* Vignette keeps the eye on the centre column. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 36%, rgba(15, 23, 42, 0) 52%, ${BACKDROP.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
