/**
 * Geometry sanity checks for the rig + pose library.
 * Not part of the video bundle. Run with:
 *   npx tsc scripts/check-poses.ts --outDir .tmp-check --module commonjs \
 *     --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck
 *   node .tmp-check/scripts/check-poses.js
 */
import { POSES, POSE_NAMES, mixPose, type PoseName } from "../src/poses/poses";
import { solveSkeleton } from "../src/rig/skeleton";
import { RIG } from "../src/rig/skeleton";

const failures: string[] = [];

const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) {
    failures.push(`${label}: ${detail}`);
  }
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} ${detail}`);
};

const round = (n: number) => Math.round(n * 10) / 10;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const headBottom = (head: { x: number; y: number }) => ({
  x: head.x,
  y: head.y + RIG.headRadius,
});

const EXPECTED: Record<PoseName, string> = {
  idle: "arms down, feet grounded",
  talking: "right hand up at chest height",
  pointing: "right arm straight out to the right",
  thinking: "right hand near the chin",
  surprised: "arms up and out in a V, wide eyes, O mouth",
  happy: "arms up in a V, smile arc",
};

const VIDEOS: PoseName[] = [...POSE_NAMES];

for (const name of VIDEOS) {
  const pose = POSES[name];
  const s = solveSkeleton(pose.angles);

  const points = Object.entries(s) as [string, { x: number; y: number }][];
  const finite = points.every(([, p]) => Number.isFinite(p.x) && Number.isFinite(p.y));
  check(`${name} joints finite`, finite, "");

  const allX = points.map(([, p]) => p.x);
  const allY = points.map(([, p]) => p.y);
  check(
    `${name} inside rig canvas`,
    Math.min(...allX) > -200 && Math.max(...allX) < 200 && Math.min(...allY) > -290 && Math.max(...allY) < 180,
    `x ${round(Math.min(...allX))}..${round(Math.max(...allX))}  y ${round(Math.min(...allY))}..${round(Math.max(...allY))}`,
  );

  const feet = Math.max(s.ankleL.y, s.ankleR.y);
  check(
    `${name} feet near ground`,
    name === "surprised" ? feet > 120 && feet < 165 : feet > 130 && feet < 160,
    `ankle y ${round(feet)}`,
  );

  if (name === "pointing") {
    check(
      `${name} right hand points right`,
      s.handR.x > 100 && s.handR.y > -140 && s.handR.y < -40,
      `hand (${round(s.handR.x)}, ${round(s.handR.y)})`,
    );
  }

  if (name === "thinking") {
    const chin = headBottom(s.head);
    check(
      `${name} hand near chin`,
      dist(s.handR, chin) < 55,
      `hand (${round(s.handR.x)}, ${round(s.handR.y)}) chin (${round(chin.x)}, ${round(chin.y)}) d=${round(dist(s.handR, chin))}`,
    );
  }

  if (name === "surprised" || name === "happy") {
    // The arms must read as a V: up, spread wide, and OUTSIDE the head
    // silhouette. Hands do not need to clear the top of the head (the upper
    // arm is too short for that without the elbow cutting through the head) -
    // the "curl over the head" bug was the elbows landing inside the head.
    const silhouette = RIG.headRadius + 8;
    const handClearance = Math.min(
      dist(s.handL, s.head),
      dist(s.handR, s.head),
    );
    const elbowClearance = Math.min(
      dist(s.elbowL, s.head),
      dist(s.elbowR, s.head),
    );
    const spread = Math.abs(s.handL.x - s.handR.x);
    const aboveHeadCentre =
      s.handL.y < s.head.y - 10 && s.handR.y < s.head.y - 10;

    check(
      `${name} hands clear head silhouette`,
      handClearance > silhouette + 12,
      `${round(handClearance)} > ${silhouette + 12}`,
    );
    check(
      `${name} elbows clear head silhouette`,
      elbowClearance > silhouette,
      `${round(elbowClearance)} > ${silhouette}`,
    );
    check(
      `${name} hands above head centre`,
      aboveHeadCentre,
      `hands y ${round(s.handL.y)} / ${round(s.handR.y)}  head y ${round(s.head.y)}`,
    );
    check(
      `${name} arms spread wide (V)`,
      spread > 150,
      `spread ${round(spread)}`,
    );
  }

  console.log(
    `      ${name.padEnd(10)} ${EXPECTED[name]}\n` +
      `      head (${round(s.head.x)}, ${round(s.head.y)})  hands (${round(s.handL.x)},${round(s.handL.y)}) (${round(s.handR.x)},${round(s.handR.y)})`,
  );
}

// Blend must stay finite everywhere, including spring overshoot (progress > 1).
let blendFinite = true;
for (const a of POSE_NAMES) {
  for (const b of POSE_NAMES) {
    for (const t of [0, 0.25, 0.5, 1, 1.08]) {
      const mixed = mixPose(POSES[a], POSES[b], t);
      const solved = solveSkeleton(mixed.angles);
      if (!Object.values(solved).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) {
        blendFinite = false;
      }
      if (!Object.values(mixed.face).every((v) => Number.isFinite(v))) {
        blendFinite = false;
      }
    }
  }
}
check("all pose blends finite (incl. overshoot)", blendFinite, "36 pairs x 5 t values");

console.log(
  failures.length === 0
    ? "\nALL CHECKS PASSED"
    : `\n${failures.length} CHECK(S) FAILED:\n- ${failures.join("\n- ")}`,
);

if (failures.length > 0) {
  process.exit(1);
}
