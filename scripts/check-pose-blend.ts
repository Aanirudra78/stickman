/**
 * Verifies the pose blend curve: 8-frame eased arrival, plus a spring
 * overshoot for pointing / surprised / happy and no overshoot for the rest.
 * Run: npx tsc scripts/check-pose-blend.ts --outDir .tmp-check --module commonjs
 *        --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *      node .tmp-check/scripts/check-pose-blend.js
 */
import { getPoseBlend, POSE_TRANSITION_FRAMES } from "../src/animation/motion";
import { POSE_NAMES, SPRING_POSES, type PoseName } from "../src/poses/poses";

const FPS = 30;
let failures = 0;

for (const pose of POSE_NAMES) {
  const samples: number[] = [];
  for (let f = 0; f <= 24; f++) {
    samples.push(getPoseBlend(f, pose, FPS));
  }

  const max = Math.max(...samples);
  const atEight = getPoseBlend(POSE_TRANSITION_FRAMES, pose, FPS);
  const settled = getPoseBlend(24, pose, FPS);
  const shouldOvershoot = SPRING_POSES.includes(pose as PoseName);

  const overshootOk = shouldOvershoot ? max > 1.02 && max < 1.2 : max <= 1.0001;
  const settleOk = Math.abs(settled - 1) < 0.001;
  const startsAtZero = samples[0] === 0;

  const ok = overshootOk && settleOk && startsAtZero;
  if (!ok) failures++;

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${pose.padEnd(10)} start=${samples[0].toFixed(3)} ` +
      `f8=${atEight.toFixed(3)} peak=${max.toFixed(3)} settled=${settled.toFixed(3)} ` +
      `spring=${shouldOvershoot}`,
  );
  console.log(
    `      curve: ${samples.slice(0, 16).map((v) => v.toFixed(2)).join(" ")}`,
  );
}

console.log(failures === 0 ? "\nPOSE BLEND OK" : `\n${failures} POSE BLEND FAILURE(S)`);
if (failures > 0) process.exit(1);
