import React from "react";
import { COLORS } from "../config";
import type { FaceParams, JointAngles } from "../poses/poses";
import type { PropId } from "../props/ids";
import { PropShape } from "../props/Props";
import {
  RIG,
  STICKMAN_HEIGHT,
  STICKMAN_VIEWBOX,
  STICKMAN_WIDTH,
  solveSkeleton,
  type Point,
} from "./skeleton";

/**
 * Stickman rig - pure SVG painting. DO NOT add scene/timeline logic here.
 *
 * Joint positions come from `solveSkeleton()` (./skeleton.ts); this file only
 * draws them plus the face. All animation (pose blending, bob, blink, mouth)
 * is computed outside the rig.
 */

const STROKE = 16;
const INK = COLORS.ink;
/** Filled "mitten" at the end of each arm - reads at small sizes. */
const HAND_RADIUS = 10.5;
/** Shoes are a chunkier pass over the last leg segment. */
const SHOE_STROKE = STROKE + 7;

/**
 * Face sizing. The character is often scaled down, so the features are drawn
 * deliberately large/chunky: big eyes, a thick mouth line and a crisp,
 * readable "O" mouth.
 */
const EYE_X = 17;
const EYE_RX = 7;
const EYE_Y = -6;
const GAZE_LIMIT = 2.6;
const MOUTH_BASE_WIDTH = 19;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toPolyline = (list: Point[]) =>
  list.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

export type StickmanProp = {
  id: PropId;
  /** Which hand holds it. Defaults to the right hand. */
  hand?: "L" | "R";
  scale?: number;
  /** Extra rotation in degrees, on top of the hand-aligned tilt. */
  rotate?: number;
  opacity?: number;
};

export type StickmanProps = {
  angles: JointAngles;
  face: FaceParams;
  /** 0 = eyes closed, 1 = fully open. */
  blink?: number;
  /** Props held in the hands (drawn after the hands). */
  props?: readonly StickmanProp[];
  /**
   * How far the floor is from the hip, in rig px. Jumping moves the whole SVG
   * up, so the contact shadow must be pushed back down by the same amount to
   * stay on the ground. Defaults to the resting floor line.
   */
  groundY?: number;
};

export const Stickman: React.FC<StickmanProps> = ({
  angles,
  face,
  blink = 1,
  props = [],
  groundY = 158,
}) => {
  const s = solveSkeleton(angles);

  // ---- Face -------------------------------------------------------------
  const eyeOpen = clamp(face.eyeOpen * blink, 0.04, 1.8);
  const happyEyes = clamp(face.happyEyes, 0, 1);
  const roundEyeOpacity = 1 - happyEyes;
  // A closed eye must not get a highlight punched through it.
  const glintOpacity = clamp((eyeOpen - 0.3) * 1.6, 0, 1);

  const gazeX = clamp(face.gazeX, -GAZE_LIMIT, GAZE_LIMIT);
  const gazeY = clamp(face.gazeY, -GAZE_LIMIT, GAZE_LIMIT);

  const browY = -21 - face.browLift * 6;
  const browTilt = face.browTilt * 14;

  const mouthWidth = MOUTH_BASE_WIDTH * face.mouthWidth;
  const mouthOpenAmount = clamp(face.mouthOpen, 0, 1);
  const openOpacity = clamp(mouthOpenAmount * 1.8, 0, 1);
  const curveOpacity = 1 - openOpacity;
  const smileDrop = face.mouthSmile * 11 + mouthOpenAmount * 3;

  return (
    <svg
      viewBox={STICKMAN_VIEWBOX}
      width={STICKMAN_WIDTH}
      height={STICKMAN_HEIGHT}
      style={{ overflow: "visible" }}
    >
      {/* Ground shadow: keeps the character planted on the floor. */}
      <ellipse cx={0} cy={groundY} rx={104} ry={13} fill={COLORS.shadow} />

      <g
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Legs */}
        <polyline points={toPolyline([s.hipL, s.kneeL, s.ankleL, s.footL])} />
        <polyline points={toPolyline([s.hipR, s.kneeR, s.ankleR, s.footR])} />

        {/* Shoes: a thicker pass over the ankle->toe segment */}
        <line
          x1={s.ankleL.x}
          y1={s.ankleL.y}
          x2={s.footL.x}
          y2={s.footL.y}
          strokeWidth={SHOE_STROKE}
        />
        <line
          x1={s.ankleR.x}
          y1={s.ankleR.y}
          x2={s.footR.x}
          y2={s.footR.y}
          strokeWidth={SHOE_STROKE}
        />

        {/* Torso */}
        <line
          x1={s.hip.x}
          y1={s.hip.y}
          x2={s.neck.x}
          y2={s.neck.y}
          strokeWidth={STROKE + 2}
        />

        {/* Arms */}
        <polyline points={toPolyline([s.shoulderL, s.elbowL, s.handL])} />
        <polyline points={toPolyline([s.shoulderR, s.elbowR, s.handR])} />
      </g>

      {/* Hands: filled tips so the gesture has a visible "point". */}
      <g fill={INK}>
        <circle cx={s.handL.x} cy={s.handL.y} r={HAND_RADIUS} />
        <circle cx={s.handR.x} cy={s.handR.y} r={HAND_RADIUS} />
      </g>

      {/* Head */}
      <g
        transform={`translate(${s.head.x} ${s.head.y}) rotate(${
          angles.headTilt + angles.spine * 0.4
        })`}
      >
        {/* The white fill hides the neck/torso cap, so the face sits on a
            clean disc instead of a black blob above the chin. */}
        <circle
          cx={0}
          cy={0}
          r={RIG.headRadius}
          fill={COLORS.background}
          stroke={INK}
          strokeWidth={STROKE - 1}
        />

        {/* Brows */}
        <g
          stroke={INK}
          strokeWidth={6}
          strokeLinecap="round"
          opacity={clamp(1 - happyEyes, 0.15, 1)}
        >
          <line
            x1={-26}
            y1={browY}
            x2={-10}
            y2={browY}
            transform={`rotate(${browTilt} -18 ${browY})`}
          />
          <line
            x1={10}
            y1={browY}
            x2={26}
            y2={browY}
            transform={`rotate(${-browTilt} 18 ${browY})`}
          />
        </g>

        {/* Round eyes (blinking squashes them vertically, gaze shifts them) */}
        <g
          opacity={roundEyeOpacity}
          fill={INK}
          transform={`translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`}
        >
          <ellipse cx={-EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RX * eyeOpen} />
          <ellipse cx={EYE_X} cy={EYE_Y} rx={EYE_RX} ry={EYE_RX * eyeOpen} />
          {/* Specular dot = life. Light comes from the top-left. */}
          <circle
            cx={-EYE_X - 2.3}
            cy={EYE_Y - 2.5}
            r={2.4}
            fill={COLORS.background}
            opacity={glintOpacity}
          />
          <circle
            cx={EYE_X - 2.3}
            cy={EYE_Y - 2.5}
            r={2.4}
            fill={COLORS.background}
            opacity={glintOpacity}
          />
        </g>

        {/* Happy "^ ^" eyes */}
        <g
          opacity={happyEyes}
          stroke={INK}
          strokeWidth={6.5}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M -24 -4 Q -17 -15 -10 -4" />
          <path d="M 10 -4 Q 17 -15 24 -4" />
        </g>

        {/* Mouth: smile curve cross-fades into an open ellipse.
            The head is filled white, so the mouth only has to stay inside the
            face disc. The open "O" reaches ~27.5 local px, well inside the
            inner stroke (36.5), so surprise never touches the chin. */}
        <g transform="translate(0 13)">
          <path
            d={`M ${-mouthWidth} 0 Q 0 ${smileDrop} ${mouthWidth} 0`}
            fill="none"
            stroke={INK}
            strokeWidth={6.5}
            strokeLinecap="round"
            opacity={curveOpacity}
          />
          <ellipse
            cx={0}
            cy={1.5}
            rx={mouthWidth * 0.72}
            ry={2.5 + 11 * mouthOpenAmount}
            fill={INK}
            opacity={openOpacity}
          />
        </g>
      </g>

      {/* Props are drawn last so they sit on top of the hand (and of the face
          when the action brings food/drink to the mouth). */}
      {props.map((prop, index) => {
        const hand = prop.hand === "L" ? s.handL : s.handR;
        const tilt = (prop.hand === "L" ? -8 : 8) + (prop.rotate ?? 0);
        return (
          <g
            key={`${prop.id}-${index}`}
            transform={`translate(${hand.x.toFixed(2)} ${hand.y.toFixed(
              2,
            )}) rotate(${tilt.toFixed(2)}) scale(${(prop.scale ?? 0.9).toFixed(
              2,
            )})`}
            opacity={prop.opacity ?? 1}
          >
            <PropShape id={prop.id} />
          </g>
        );
      })}
    </svg>
  );
};

export {
  STICKMAN_HEIGHT,
  STICKMAN_HIP_X,
  STICKMAN_HIP_Y,
  STICKMAN_WIDTH,
} from "./skeleton";
