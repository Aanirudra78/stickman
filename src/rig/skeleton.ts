import type { JointAngles } from "../poses/poses";

/**
 * Joint solver for the stickman rig. Pure math, no React, no SVG.
 * Given joint angles it returns every joint in rig-local pixels.
 *
 * Coordinate system: origin = hip, +x = screen right, +y = screen down.
 * Angle convention: 0 = straight down, +90 = screen right (see poses.ts).
 */

export const RIG = {
  torso: 132,
  headRadius: 44,
  headOffset: 40,
  shoulderDx: 8,
  shoulderDy: 14,
  upperArm: 60,
  forearm: 56,
  hipDx: 10,
  thigh: 76,
  shin: 72,
  foot: 22,
} as const;

/** Size of the SVG canvas in px. The hip sits at (HIP_X, HIP_Y). */
export const STICKMAN_WIDTH = 400;
export const STICKMAN_HEIGHT = 480;
export const STICKMAN_VIEWBOX = "-200 -300 400 480";
export const STICKMAN_HIP_X = 200;
export const STICKMAN_HIP_Y = 300;

export type Point = { x: number; y: number };

export type Skeleton = {
  hip: Point;
  neck: Point;
  head: Point;
  shoulderL: Point;
  elbowL: Point;
  handL: Point;
  shoulderR: Point;
  elbowR: Point;
  handR: Point;
  hipL: Point;
  kneeL: Point;
  ankleL: Point;
  footL: Point;
  hipR: Point;
  kneeR: Point;
  ankleR: Point;
  footR: Point;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** angle 0 = straight down, +90 = screen right. */
export const limb = (origin: Point, angle: number, length: number): Point => ({
  x: origin.x + Math.sin(toRad(angle)) * length,
  y: origin.y + Math.cos(toRad(angle)) * length,
});

/** Head centre above the neck, rotated by `tilt`. */
export const headPoint = (neck: Point, tilt: number): Point => ({
  x: neck.x + Math.sin(toRad(tilt)) * RIG.headOffset,
  y: neck.y - Math.cos(toRad(tilt)) * RIG.headOffset,
});

export const solveSkeleton = (angles: JointAngles): Skeleton => {
  const hip: Point = { x: 0, y: 0 };

  // Torso points up; spine 0 = vertical.
  const neck: Point = {
    x: Math.sin(toRad(angles.spine)) * RIG.torso,
    y: -Math.cos(toRad(angles.spine)) * RIG.torso,
  };

  const head = headPoint(neck, angles.headTilt);

  const shoulderL: Point = {
    x: neck.x - RIG.shoulderDx,
    y: neck.y + RIG.shoulderDy,
  };
  const shoulderR: Point = {
    x: neck.x + RIG.shoulderDx,
    y: neck.y + RIG.shoulderDy,
  };

  const elbowL = limb(shoulderL, angles.shoulderL, RIG.upperArm);
  const handL = limb(elbowL, angles.elbowL, RIG.forearm);
  const elbowR = limb(shoulderR, angles.shoulderR, RIG.upperArm);
  const handR = limb(elbowR, angles.elbowR, RIG.forearm);

  const hipL: Point = { x: hip.x - RIG.hipDx, y: hip.y };
  const hipR: Point = { x: hip.x + RIG.hipDx, y: hip.y };

  const kneeL = limb(hipL, angles.hipL, RIG.thigh);
  const ankleL = limb(kneeL, angles.kneeL, RIG.shin);
  const kneeR = limb(hipR, angles.hipR, RIG.thigh);
  const ankleR = limb(kneeR, angles.kneeR, RIG.shin);

  return {
    hip,
    neck,
    head,
    shoulderL,
    elbowL,
    handL,
    shoulderR,
    elbowR,
    handR,
    hipL,
    kneeL,
    ankleL,
    footL: { x: ankleL.x - RIG.foot, y: ankleL.y + 2 },
    hipR,
    kneeR,
    ankleR,
    footR: { x: ankleR.x + RIG.foot, y: ankleR.y + 2 },
  };
};
