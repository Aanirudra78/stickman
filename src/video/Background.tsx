import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../config";
import { TEXT_FONT_FAMILY } from "../fonts";
import {
  ENV_MOODS,
  ENV_PALETTES,
  type EnvId,
  type EnvMood,
  type EnvPalette,
  type MoodLight,
  withAlpha,
} from "./environments";
import { ENV_PLATES } from "./env-plates";

/**
 * Persistent background system - now a directed ENVIRONMENT, not a wash.
 *
 * Each scene picks an environment (study / office / duskCity / park /
 * dreamNight - see environments.ts) and this file paints it in three parallax
 * depth layers:
 *
 *   far   - sky details: windows, sun, moon, hills      (drifts the least)
 *   mid   - furniture, buildings, trees                 (drifts more)
 *   floor - the band the character stands on            (drifts the most)
 *
 * Layers drift on slow, incommensurate sine paths so the world feels alive
 * without ever visibly looping, and the whole stack scales gently through the
 * scene (a camera breath) - the character's own camera push-in on top of that
 * gives real two-plane depth.
 *
 * The CONTRAST CONTRACT lives in environments.ts: caption zone stays light,
 * silhouettes stay low, the stage gets a light glow. All art is static per
 * scene except the drift, so the motion probes only ever see character motion
 * plus a few pixels of parallax.
 */

const FRAME_W = 1080;
const FRAME_H = 1920;

/**
 * Deterministic flicker for neon/lamp moods: two incommensurate sines; the
 * light dips only when their sum crosses a threshold, so it buzzes briefly
 * every few seconds and sits steady otherwise.
 */
const flickerDip = (t: number, phase: number, depth: number): number => {
  const buzz = Math.sin(t * 6.4 + phase) + Math.sin(t * 13.9 + phase * 2.3);
  return buzz > 1.25 ? depth * (buzz - 1.25) : 0;
};

/** Soft light pool drawn on the plate - lamp glow, sun spill, neon. */
const MoodPool: React.FC<{ light: MoodLight; t: number }> = ({ light, t }) => {
  const breath = Math.sin(t * light.breath + light.phase) * 0.22 * light.alpha;
  const dip = flickerDip(t, light.phase, light.flicker ?? 0) * light.alpha;
  const alpha = Math.max(0.02, light.alpha + breath - dip);
  return (
    <div
      style={{
        position: "absolute",
        left: light.x - light.r,
        top: light.y - light.r,
        width: light.r * 2,
        height: light.r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${withAlpha(light.color, alpha)} 0%, ${withAlpha(
          light.color,
          alpha * 0.4,
        )} 45%, transparent 72%)`,
      }}
    />
  );
};

/** Rotated window-light shaft over the plate. */
const MoodShaft: React.FC<{ shaft: NonNullable<EnvMood["shaft"]>; t: number }> = ({
  shaft,
  t,
}) => (
  <div
    style={{
      position: "absolute",
      left: shaft.x,
      top: shaft.y,
      width: shaft.w,
      height: shaft.h,
      transform: `rotate(${shaft.angle}deg)`,
      transformOrigin: "top left",
      background: `linear-gradient(180deg, ${withAlpha(shaft.color, shaft.alpha)} 0%, ${withAlpha(
        shaft.color,
        shaft.alpha * 0.35,
      )} 55%, transparent 100%)`,
      opacity: 1 + Math.sin(t * 0.4) * 0.08,
    }}
  />
);

/** Per-layer drift + base parallax so closer layers move more. */
const layerDrift = (
  t: number,
  sceneStart: number,
  fps: number,
  amplitude: number,
  phase: number,
) => {
  const local = (frame: number) => (frame - sceneStart) / fps;
  const x = Math.sin(local(t * fps) * 0.11 + phase) * amplitude;
  const y = Math.cos(local(t * fps) * 0.08 + phase * 1.7) * amplitude * 0.45;
  return { x, y };
};

type EnvArt = {
  far: React.ReactNode;
  mid: React.ReactNode;
  floor: React.ReactNode;
};

/* ------------------------------------------------------------------ shared */

const BookSpine: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  tilt?: number;
}> = ({ x, y, w, h, color, tilt = 0 }) => (
  <rect
    x={x}
    y={y - h}
    width={w}
    height={h}
    rx={3}
    fill={color}
    transform={tilt ? `rotate(${tilt} ${x + w / 2} ${y})` : undefined}
  />
);

const WindowGlow: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  light: string;
  frameColor: string;
  sun?: string;
}> = ({ x, y, w, h, light, frameColor, sun }) => (
  <g>
    {/* light shaft spilling out of the window */}
    <path
      d={`M ${x + 12} ${y + 8} L ${x + w - 12} ${y + 8} L ${x + w + 150} ${y + h + 430} L ${x - 190} ${y + h + 430} Z`}
      fill="rgba(255, 252, 240, 0.34)"
    />
    <rect x={x} y={y} width={w} height={h} rx={16} fill={light} stroke={frameColor} strokeWidth={10} />
    <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={frameColor} strokeWidth={7} />
    <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke={frameColor} strokeWidth={7} />
    {sun ? (
      <circle cx={x + w * 0.32} cy={y + h * 0.3} r={52} fill={sun} opacity={0.75} />
    ) : null}
  </g>
);

const PottedPlant: React.FC<{
  x: number;
  y: number;
  scale: number;
  leaf: string;
  pot: string;
  line: string;
}> = ({ x, y, scale, leaf, pot, line }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M -30 0 L 30 0 L 20 70 L -20 70 Z" fill={pot} stroke={line} strokeWidth={5} />
    <path d="M 0 0 C -4 -46 -30 -70 -44 -78 C -12 -78 4 -52 0 0" fill={leaf} stroke={line} strokeWidth={4.5} />
    <path d="M 0 0 C 4 -56 26 -88 44 -98 C 14 -94 -2 -60 0 0" fill={leaf} stroke={line} strokeWidth={4.5} />
    <path d="M 0 2 C 0 -60 0 -92 0 -110" stroke={line} strokeWidth={5} fill="none" strokeLinecap="round" />
    <circle cx={0} cy={-118} r={17} fill={leaf} stroke={line} strokeWidth={4.5} />
  </g>
);

const WallClock: React.FC<{ x: number; y: number; r: number; line: string; accent: string }> = ({
  x,
  y,
  r,
  line,
  accent,
}) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#FFFFFF" stroke={line} strokeWidth={7} />
    <line x1={x} y1={y} x2={x + r * 0.45} y2={y - r * 0.3} stroke={line} strokeWidth={6} strokeLinecap="round" />
    <line x1={x} y1={y} x2={x - r * 0.2} y2={y - r * 0.62} stroke={accent} strokeWidth={6} strokeLinecap="round" />
    <circle cx={x} cy={y} r={5} fill={accent} />
  </g>
);

/* ------------------------------------------------------------------ study */

const studyArt = (p: EnvPalette): EnvArt => ({
  far: (
    <g>
      {/* Bookshelf on the left wall (kept below the caption text block). */}
      <rect x={70} y={620} width={350} height={520} rx={14} fill="#FFFFFF" stroke={p.midLine} strokeWidth={9} />
      {[710, 830, 950, 1070].map((shelfY, row) => (
        <g key={shelfY}>
          <rect x={88} y={shelfY} width={314} height={12} rx={4} fill={p.mid} />
          {[
            [p.accent, 26],
            [p.accent2, 20],
            ["#5E8A6E", 32],
            ["#B0653A", 22],
            ["#4E6E8E", 28],
            [p.accent2, 18],
          ]
            .slice(0, 5 - (row % 2))
            .reduce<{ books: React.ReactNode[]; cursor: number }>(
              (state, [color, width], index) => {
                state.books.push(
                  <BookSpine
                    key={`${row}-${index}`}
                    x={100 + state.cursor}
                    y={shelfY}
                    w={width as number}
                    h={86 - ((index + row) % 3) * 12}
                    color={color as string}
                    tilt={index === 4 - (row % 2) ? -7 : 0}
                  />,
                );
                state.cursor += (width as number) + 7;
                return state;
              },
              { books: [], cursor: 0 },
            ).books}
        </g>
      ))}
      {/* Window on the right wall, kept below the caption band. */}
      <WindowGlow
        x={720}
        y={850}
        w={290}
        h={310}
        light="#FDFBF4"
        frameColor={p.midLine}
        sun="rgba(217, 119, 6, 0.35)"
      />
    </g>
  ),
  mid: (
    <g>
      {/* Desk with laptop + mug, left of the stage. */}
      <rect x={30} y={1210} width={470} height={26} rx={8} fill={p.mid} stroke={p.midLine} strokeWidth={6} />
      <rect x={70} y={1236} width={22} height={280} rx={6} fill={p.mid} />
      <rect x={420} y={1236} width={22} height={280} rx={6} fill={p.mid} />
      <g>
        <path d="M 250 1210 L 250 1110 L 330 1110 L 330 1210" fill="#E8F0F8" stroke={p.midLine} strokeWidth={6} />
        <path d="M 242 1210 L 338 1210" stroke={p.midLine} strokeWidth={8} strokeLinecap="round" />
      </g>
      <g>
        <rect x={370} y={1168} width={44} height={42} rx={8} fill={p.accent} opacity={0.85} />
        <path d="M 414 1176 a 12 12 0 0 1 0 26" fill="none" stroke={p.accent} strokeWidth={7} />
      </g>
      <PottedPlant x={560} y={1470} scale={1.25} leaf="#5E8A6E" pot={p.mid} line={p.midLine} />
      {/* Picture frame between the shelf and the window. */}
      <rect x={470} y={920} width={170} height={130} rx={10} fill="#FFFFFF" stroke={p.midLine} strokeWidth={7} />
      <rect x={492} y={944} width={126} height={82} rx={6} fill={p.far} />
      <path d="M 500 1016 L 536 974 L 562 1004 L 588 964 L 614 1016 Z" fill={p.accent} opacity={0.55} />
    </g>
  ),
  floor: (
    <g>
      <rect x={0} y={1500} width={FRAME_W} height={FRAME_H - 1500} fill={p.floor} />
      <rect x={0} y={1500} width={FRAME_W} height={8} fill={p.floorLine} opacity={0.55} />
      {[1560, 1640, 1730, 1830].map((y) => (
        <line key={y} x1={0} y1={y} x2={FRAME_W} y2={y} stroke={p.floorLine} strokeWidth={2.5} opacity={0.35} />
      ))}
      <ellipse cx={540} cy={1580} rx={390} ry={86} fill={p.accent} opacity={0.07} />
    </g>
  ),
});

/* ----------------------------------------------------------------- office */

const officeArt = (p: EnvPalette): EnvArt => ({
  far: (
    <g>
      {/* Window with blinds - below the caption band so text contrast holds. */}
      <WindowGlow x={90} y={850} w={330} h={290} light="#F7FBFF" frameColor={p.midLine} />
      {[906, 962, 1018, 1074].map((y) => (
        <rect key={y} x={102} y={y} width={306} height={15} fill={p.far} opacity={0.85} />
      ))}
      {/* Whiteboard with a plan on it (kept low, under the caption band). */}
      <rect x={620} y={840} width={380} height={400} rx={14} fill="#FFFFFF" stroke={p.midLine} strokeWidth={9} />
      <line x1={660} y1={930} x2={880} y2={930} stroke={p.accent} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
      <line x1={660} y1={990} x2={940} y2={990} stroke={p.mid} strokeWidth={7} strokeLinecap="round" opacity={0.7} />
      <line x1={660} y1={1044} x2={900} y2={1044} stroke={p.mid} strokeWidth={7} strokeLinecap="round" opacity={0.6} />
      <path
        d="M 668 1160 L 720 1116 L 768 1148 L 830 1080 L 900 1120"
        fill="none"
        stroke={p.accent}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M 900 1120 l 0 -26 m 0 26 l -26 0" stroke={p.accent} strokeWidth={8} strokeLinecap="round" fill="none" />
      <rect x={940} y={970} width={34} height={34} rx={4} fill={p.accent2} opacity={0.6} />
      <rect x={940} y={1020} width={34} height={34} rx={4} fill={p.accent} opacity={0.5} />
    </g>
  ),
  mid: (
    <g>
      {/* Filing cabinet (kept clear of the window above it). */}
      <rect x={40} y={1170} width={230} height={320} rx={12} fill={p.mid} stroke={p.midLine} strokeWidth={7} />
      {[1205, 1290, 1375].map((y) => (
        <g key={y}>
          <rect x={62} y={y} width={186} height={72} rx={8} fill={p.far} stroke={p.midLine} strokeWidth={4} />
          <rect x={130} y={y + 30} width={50} height={9} rx={4} fill={p.midLine} opacity={0.8} />
        </g>
      ))}
      <WallClock x={520} y={940} r={62} line={p.midLine} accent={p.accent} />
      <PottedPlant x={950} y={1480} scale={1.15} leaf="#5E8A6E" pot={p.mid} line={p.midLine} />
      {/* Desk edge on the right, under the guest spot. */}
      <rect x={760} y={1260} width={320} height={22} rx={8} fill={p.mid} stroke={p.midLine} strokeWidth={5} />
      <rect x={790} y={1282} width={18} height={210} rx={6} fill={p.mid} />
      <rect x={1030} y={1282} width={18} height={210} rx={6} fill={p.mid} />
    </g>
  ),
  floor: (
    <g>
      <rect x={0} y={1500} width={FRAME_W} height={FRAME_H - 1500} fill={p.floor} />
      <rect x={0} y={1500} width={FRAME_W} height={8} fill={p.floorLine} opacity={0.5} />
      {[0, 1, 2, 3, 4].map((column) => (
        <line
          key={column}
          x1={column * 270}
          y1={1520}
          x2={column * 270 - 90}
          y2={FRAME_H}
          stroke={p.floorLine}
          strokeWidth={2.5}
          opacity={0.3}
        />
      ))}
      <ellipse cx={540} cy={1580} rx={390} ry={86} fill={p.accent} opacity={0.05} />
    </g>
  ),
});

/* -------------------------------------------------------------- duskCity */

const duskCityArt = (p: EnvPalette): EnvArt => ({
  far: (
    <g>
      {/* Low sun with a long warm glow. */}
      <circle cx={770} cy={1210} r={210} fill="rgba(217, 119, 6, 0.16)" />
      <circle cx={770} cy={1210} r={104} fill="rgba(240, 150, 40, 0.5)" />
      {/* Soft cloud bands. */}
      {[
        [180, 470, 300, 26],
        [520, 560, 380, 30],
        [760, 400, 260, 22],
      ].map(([cx, cy, w, h], index) => (
        <rect
          key={index}
          x={cx}
          y={cy}
          width={w}
          height={h}
          rx={h / 2}
          fill="#FFFFFF"
          opacity={0.5}
        />
      ))}
      {/* Birds. */}
      <path d="M 300 380 q 14 -14 28 0 q 14 -14 28 0" stroke={p.mid} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M 420 440 q 11 -11 22 0 q 11 -11 22 0" stroke={p.mid} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      {/* Faint early stars up top. */}
      {[
        [120, 200],
        [330, 150],
        [640, 120],
        [930, 180],
        [990, 330],
      ].map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={4} fill="#FFFFFF" opacity={0.8} />
      ))}
    </g>
  ),
  mid: (
    <g>
      {/* Skyline: varied buildings with lit windows. */}
      {[
        { x: -30, w: 200, h: 560 },
        { x: 190, w: 160, h: 700 },
        { x: 370, w: 210, h: 480 },
        { x: 600, w: 170, h: 640 },
        { x: 790, w: 200, h: 520 },
        { x: 1010, w: 110, h: 660 },
      ].map((building, index) => {
        const top = 1500 - building.h;
        const windows: React.ReactNode[] = [];
        for (let row = 0; row < Math.floor(building.h / 110); row++) {
          for (let column = 0; column < Math.floor(building.w / 74); column++) {
            if ((row * 3 + column * 5 + index) % 4 !== 0) continue;
            windows.push(
              <rect
                key={`${row}-${column}`}
                x={building.x + 26 + column * 74}
                y={top + 50 + row * 110}
                width={26}
                height={38}
                rx={3}
                fill="rgba(255, 196, 87, 0.75)"
              />,
            );
          }
        }
        return (
          <g key={index}>
            <rect
              x={building.x}
              y={top}
              width={building.w}
              height={building.h}
              fill={index % 2 ? p.mid : p.midLine}
              opacity={0.92}
            />
            {windows}
          </g>
        );
      })}
    </g>
  ),
  floor: (
    <g>
      {/* Rooftop band with a railing. */}
      <rect x={0} y={1500} width={FRAME_W} height={FRAME_H - 1500} fill={p.floor} />
      <rect x={0} y={1500} width={FRAME_W} height={8} fill={p.floorLine} opacity={0.6} />
      {Array.from({ length: 9 }).map((_, index) => (
        <rect key={index} x={index * 135} y={1438} width={9} height={64} rx={4} fill={p.midLine} opacity={0.8} />
      ))}
      <rect x={0} y={1432} width={FRAME_W} height={10} rx={5} fill={p.midLine} opacity={0.8} />
      <ellipse cx={540} cy={1580} rx={390} ry={86} fill={p.accent} opacity={0.08} />
    </g>
  ),
});

/* ------------------------------------------------------------------- park */

const parkArt = (p: EnvPalette): EnvArt => ({
  far: (
    <g>
      {/* Morning sun. */}
      <circle cx={880} cy={360} r={190} fill="rgba(255, 200, 60, 0.22)" />
      <circle cx={880} cy={360} r={92} fill="rgba(255, 205, 70, 0.6)" />
      {/* Clouds. */}
      {[
        [170, 330, 1],
        [560, 240, 0.8],
        [760, 520, 0.65],
      ].map(([cx, cy, s], index) => (
        <g key={index} transform={`translate(${cx} ${cy}) scale(${s})`} opacity={0.85}>
          <ellipse cx={0} cy={0} rx={105} ry={36} fill="#FFFFFF" />
          <ellipse cx={-60} cy={12} rx={70} ry={26} fill="#FFFFFF" />
          <ellipse cx={62} cy={12} rx={78} ry={28} fill="#FFFFFF" />
        </g>
      ))}
      {/* Rolling hills. */}
      <path d="M -40 1420 Q 300 1210 700 1400 Q 950 1500 1120 1370 L 1120 1520 L -40 1520 Z" fill={p.far} opacity={0.9} />
      <path d="M -40 1490 Q 420 1330 820 1490 Q 1000 1560 1120 1470 L 1120 1530 L -40 1530 Z" fill={p.mid} opacity={0.75} />
    </g>
  ),
  mid: (
    <g>
      {/* Two trees framing the stage. */}
      {[
        { x: 130, s: 1.15 },
        { x: 950, s: 0.95 },
      ].map((tree, index) => (
        <g key={index} transform={`translate(${tree.x} 1490) scale(${tree.s})`}>
          <path d="M -18 0 C -12 -120 -8 -220 -6 -320 L 6 -320 C 8 -220 12 -120 18 0 Z" fill="#8A5A33" />
          <circle cx={0} cy={-390} r={120} fill={p.mid} opacity={0.95} />
          <circle cx={-88} cy={-330} r={82} fill={p.mid} opacity={0.9} />
          <circle cx={88} cy={-330} r={86} fill={p.midLine} opacity={0.75} />
          <circle cx={-40} cy={-440} r={70} fill={p.mid} opacity={0.85} />
        </g>
      ))}
      {/* Bushes along the floor line. */}
      {[520, 640, 750, 860].map((x, index) => (
        <g key={x} transform={`translate(${x} 1500)`}>
          <ellipse cx={0} cy={0} rx={index % 2 ? 52 : 64} ry={index % 2 ? 26 : 32} fill={p.midLine} opacity={0.55} />
        </g>
      ))}
    </g>
  ),
  floor: (
    <g>
      <rect x={0} y={1500} width={FRAME_W} height={FRAME_H - 1500} fill={p.floor} />
      <rect x={0} y={1500} width={FRAME_W} height={8} fill={p.floorLine} opacity={0.55} />
      {/* Grass tufts. */}
      {Array.from({ length: 16 }).map((_, index) => {
        const x = 40 + index * 66;
        const y = 1560 + ((index * 53) % 240);
        return (
          <path
            key={index}
            d={`M ${x} ${y} q 7 -26 0 -40 M ${x + 12} ${y} q 9 -20 4 -34 M ${x - 11} ${y} q -8 -18 -4 -30`}
            stroke={p.midLine}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            opacity={0.5}
          />
        );
      })}
      <ellipse cx={540} cy={1620} rx={340} ry={80} fill="#F7EFD8" opacity={0.8} />
    </g>
  ),
});

/* ------------------------------------------------------------ dreamNight */

const dreamNightArt = (p: EnvPalette): EnvArt => ({
  far: (
    <g>
      {/* Moon. */}
      <circle cx={830} cy={420} r={150} fill="rgba(255, 255, 255, 0.55)" />
      <circle cx={830} cy={420} r={86} fill="#FFFDF4" />
      <circle cx={800} cy={396} r={16} fill={p.far} opacity={0.5} />
      <circle cx={858} cy={440} r={11} fill={p.far} opacity={0.5} />
      {/* Stars. */}
      {[
        [140, 260],
        [240, 380],
        [420, 210],
        [560, 330],
        [700, 180],
        [960, 250],
        [1000, 500],
        [80, 520],
      ].map(([x, y], index) => (
        <g key={index}>
          <circle cx={x} cy={y} r={index % 3 ? 5 : 8} fill="#FFFFFF" opacity={0.9} />
        </g>
      ))}
      {/* Drifting night clouds. */}
      <ellipse cx={330} cy={620} rx={220} ry={40} fill="#FFFFFF" opacity={0.4} />
      <ellipse cx={720} cy={700} rx={180} ry={32} fill="#FFFFFF" opacity={0.3} />
    </g>
  ),
  mid: (
    <g>
      {/* Dream bubbles rising from the sleeper's stage. */}
      {[
        { x: 240, y: 1180, r: 46, o: 0.5 },
        { x: 330, y: 1040, r: 30, o: 0.6 },
        { x: 820, y: 1120, r: 40, o: 0.45 },
        { x: 900, y: 980, r: 24, o: 0.6 },
        { x: 480, y: 940, r: 18, o: 0.5 },
      ].map((bubble, index) => (
        <g key={index}>
          <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill={p.accent} opacity={bubble.o * 0.28} />
          <circle cx={bubble.x} cy={bubble.y} r={bubble.r} fill="none" stroke={p.accent} strokeWidth={3.5} opacity={bubble.o * 0.6} />
        </g>
      ))}
      {/* Window with moonlight. */}
      <g>
        <rect x={70} y={940} width={230} height={300} rx={14} fill="#FFFFFF" opacity={0.75} stroke={p.midLine} strokeWidth={8} />
        <line x1={185} y1={940} x2={185} y2={1240} stroke={p.midLine} strokeWidth={6} />
        <path d="M 150 1030 a 34 34 0 1 0 40 52 a 40 40 0 1 1 -40 -52" fill="rgba(217, 119, 6, 0.35)" />
      </g>
    </g>
  ),
  floor: (
    <g>
      <rect x={0} y={1500} width={FRAME_W} height={FRAME_H - 1500} fill={p.floor} />
      <rect x={0} y={1500} width={FRAME_W} height={8} fill={p.floorLine} opacity={0.5} />
      {/* Mist. */}
      <ellipse cx={260} cy={1620} rx={300} ry={60} fill="#FFFFFF" opacity={0.35} />
      <ellipse cx={820} cy={1680} rx={340} ry={70} fill="#FFFFFF" opacity={0.28} />
      <ellipse cx={540} cy={1580} rx={390} ry={86} fill={p.accent} opacity={0.06} />
    </g>
  ),
});

const ENV_ART: Partial<Record<EnvId, (palette: EnvPalette) => EnvArt>> = {
  study: studyArt,
  office: officeArt,
  duskCity: duskCityArt,
  park: parkArt,
  dreamNight: dreamNightArt,
};

/**
 * One environment stack: AI plate (Phase 3) or painted sky + parallax layers,
 * plus the stage glow. `opacity` drives the cross-fade between the previous
 * and current scene's environment during a scene change.
 */
const EnvironmentStack: React.FC<{
  env: EnvId;
  opacity: number;
  drift: { x: number; y: number };
  push: number;
  /** Global seconds - drives the mood light breathing/flicker. */
  t: number;
}> = ({ env, opacity, drift, push, t }) => {
  const palette = ENV_PALETTES[env];
  const plate = ENV_PLATES[env];
  if (opacity <= 0.005) return null;

  if (plate) {
    // AI-illustrated plate: one full-frame image does the world's work. The
    // plate is scaled ~4.5% past the frame so the drift and camera push never
    // reveal its edges, and a caption scrim guarantees the CONTRAST CONTRACT
    // (y 250..810 stays light) whatever the illustration does.
    const mood = ENV_MOODS[env];
    return (
      <AbsoluteFill style={{ opacity }}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={staticFile(plate)}
            width={FRAME_W}
            height={FRAME_H}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: FRAME_W,
              height: FRAME_H,
              translate: `${drift.x * 0.35}px ${drift.y * 0.35}px`,
              scale: `${push * 1.045}`,
              transformOrigin: "50% 62%",
            }}
          />
        </AbsoluteFill>

        {/* Phase 4 mood: living light on the plate - pools + window shaft.
            Breathes and flickers deterministically, never wall-clock. */}
        {mood.pools.map((light, index) => (
          <MoodPool key={`pool-${index}`} light={light} t={t} />
        ))}
        {mood.shaft ? <MoodShaft shaft={mood.shaft} t={t} /> : null}

        {/* Caption scrim: keeps the text band light over any plate. */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0) 11%, rgba(255,255,255,0.5) 14.5%, rgba(255,255,255,0.5) 40%, rgba(255,255,255,0) 44%)",
          }}
        />

        {/* Light stage glow so the ink figure always reads. */}
        <div
          style={{
            position: "absolute",
            left: 540 - 520,
            top: 1500 - 260,
            width: 1040,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, ${palette.stageGlow} 0%, transparent 68%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  const art = (ENV_ART[env] ?? studyArt)(palette);

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Sky / wall. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(172deg, ${palette.sky[0]} 0%, ${palette.sky[1]} 46%, ${palette.sky[2]} 100%)`,
        }}
      />

      {/* FAR - sky details, drifts the least. */}
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: `${drift.x * 0.3}px ${drift.y * 0.3}px`,
          scale: `${push}`,
          transformOrigin: "50% 62%",
        }}
      >
        {art.far}
      </svg>

      {/* MID - furniture / skyline, drifts more. */}
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: `${drift.x * 0.62}px ${drift.y * 0.62}px`,
          scale: `${push}`,
          transformOrigin: "50% 62%",
        }}
      >
        {art.mid}
      </svg>

      {/* Light stage glow so the ink figure always reads, whatever the env. */}
      <div
        style={{
          position: "absolute",
          left: 540 - 520,
          top: 1500 - 260,
          width: 1040,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${palette.stageGlow} 0%, transparent 68%)`,
        }}
      />

      {/* FLOOR - the band the character stands on, drifts the most. */}
      <svg
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          translate: `${drift.x}px ${drift.y}px`,
          scale: `${push}`,
          transformOrigin: "50% 62%",
        }}
      >
        {art.floor}
      </svg>
    </AbsoluteFill>
  );
};

export const Background: React.FC<{
  sceneIndex: number;
  sceneStart: number;
  /** Resolved by the timeline so selection logic stays out of the painter. */
  environment: EnvId;
  /** Previous scene's environment, for the cross-fade. */
  previousEnvironment: EnvId;
  /** Camera impact shake - moves the world, never the captions. */
  shakeX?: number;
  shakeY?: number;
  /** Seconds into the scene when a guest walks in - blooms a warm entry glow. */
  guestAt?: number;
}> = ({
  sceneIndex,
  sceneStart,
  environment,
  previousEnvironment,
  shakeX = 0,
  shakeY = 0,
  guestAt,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const local = frame - sceneStart;
  const cross = interpolate(local, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Camera breath on the whole environment stack: a very slow push that pairs
  // with the character's own camera scale for two-plane depth.
  const push = interpolate(local, [0, Math.max(1, 300)], [1.012, 1.038], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const numeralIn = interpolate(local, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const numeral = String(sceneIndex + 1).padStart(2, "0");
  const sameEnv = environment === previousEnvironment;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        translate: `${shakeX.toFixed(2)}px ${shakeY.toFixed(2)}px`,
      }}
    >
      <EnvironmentStack
        key={`prev-${previousEnvironment}`}
        env={previousEnvironment}
        opacity={sameEnv ? 0 : 1 - cross}
        drift={layerDrift(t, sceneStart, fps, 9, 0.7 + sceneIndex)}
        push={push}
        t={t}
      />
      <EnvironmentStack
        key={`curr-${environment}`}
        env={environment}
        opacity={sameEnv ? 1 : cross}
        drift={layerDrift(t, sceneStart, fps, 9, 1.9 + sceneIndex * 1.3)}
        push={push}
        t={t}
      />

      {/* Guest entrance glow: a warm pool blooms at the guest's spot as they
          walk in, so the world notices the newcomer (not just the figure). */}
      {guestAt !== undefined
        ? (() => {
            const localSeconds = (frame - sceneStart) / fps;
            const raw = interpolate(
              localSeconds - (guestAt - 0.12),
              [0, 0.55],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const bloom = 1 - Math.pow(1 - raw, 3); // easeOutCubic
            if (bloom <= 0.001) return null;
            return (
              <div
                style={{
                  position: "absolute",
                  left: 844 - 330,
                  top: 1279 - 330,
                  width: 660,
                  height: 660,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${withAlpha("#FFE2B8", 0.3 * bloom)} 0%, ${withAlpha(
                    "#FFE2B8",
                    0.12 * bloom,
                  )} 48%, transparent 72%)`,
                }}
              />
            );
          })()
        : null}

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
          color: "rgba(11, 14, 20, 0.045)",
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
          opacity: 0.055,
          mixBlendMode: "multiply",
        }}
      />

      {/* Vignette keeps the eye on the centre column. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 36%, rgba(15, 23, 42, 0) 52%, rgba(15, 23, 42, 0.055) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
