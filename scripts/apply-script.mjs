/**
 * Writes `public/script.json` from the script passed to the render workflow.
 *
 *   SCRIPT_JSON='{"title":"...","scenes":[...]}' node scripts/apply-script.mjs
 *   node scripts/apply-script.mjs path/to/script.json
 *
 * The point is to fail fast with a readable message when the phone-typed JSON
 * is broken, before we spend minutes on voice + render.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_IDS, PROP_IDS, applyDetection } from "../shared/detect.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const TARGET = path.join(ROOT, "public", "script.json");
const POSES = ["idle", "talking", "pointing", "thinking", "surprised", "happy"];
const TYPES = ["text", "points"];
const GUEST_ENTRANCES = ["walk", "jump", "magic"];
/** Detection rules + the generic "hold a prop" fallback clip. */
const ACTIONS = [...ACTION_IDS, "hold"];

const fail = (message) => {
  console.error(`script error: ${message}`);
  process.exit(1);
};

const readInput = async () => {
  const arg = process.argv[2];
  if (arg) {
    return fs.readFile(path.resolve(process.cwd(), arg), "utf8");
  }
  // The workflow always sets SCRIPT_JSON (empty when nothing was pasted), so
  // this branch decides on its own and never waits on stdin.
  if (process.env.SCRIPT_JSON !== undefined) {
    return process.env.SCRIPT_JSON;
  }
  // No TTY and no env var -> stdin may carry the JSON; a plain local run bails.
  if (process.stdin.isTTY) return "";
  // stdin, e.g. `cat script.json | node scripts/apply-script.mjs`
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const main = async () => {
  const raw = (await readInput()).trim();

  let script;
  if (!raw) {
    // Nothing pasted -> render the committed script, optionally with a new voice.
    script = JSON.parse(await fs.readFile(TARGET, "utf8"));
    console.log("no script_json input - using the committed public/script.json");
  } else {
    try {
      script = JSON.parse(raw);
    } catch (error) {
      fail(`invalid JSON - ${error.message}`);
    }
  }

  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    fail("`scenes` must be a non-empty array");
  }
  if (script.scenes.length > 12) {
    fail("too many scenes (max 12) - keep videos under a minute");
  }

  const problems = [];
  script.scenes.forEach((scene, index) => {
    const at = `scene ${index + 1}`;
    if (typeof scene.text !== "string" || scene.text.trim() === "") {
      problems.push(`${at}: missing "text"`);
    }
    if (!POSES.includes(scene.pose)) {
      problems.push(`${at}: "pose" must be one of ${POSES.join(", ")}`);
    }
    if (!TYPES.includes(scene.scene_type)) {
      problems.push(`${at}: "scene_type" must be "text" or "points"`);
    }
    if (typeof scene.duration !== "number" || !(scene.duration > 0)) {
      problems.push(`${at}: "duration" must be a positive number of seconds`);
    }
    if (typeof scene.voiceover !== "string" || scene.voiceover.trim() === "") {
      problems.push(`${at}: missing "voiceover" (needed for narration)`);
    }
    if (scene.scene_type === "points") {
      if (!Array.isArray(scene.items) || scene.items.length === 0) {
        problems.push(`${at}: points scenes need a non-empty "items" array`);
      }
    }
    if (scene.pose_changes && !Array.isArray(scene.pose_changes)) {
      problems.push(`${at}: "pose_changes" must be an array`);
    }

    if (scene.actions !== undefined) {
      if (!Array.isArray(scene.actions)) {
        problems.push(`${at}: "actions" must be an array of { at, id }`);
      } else {
        scene.actions.forEach((action, actionIndex) => {
          const actionAt = `${at}, actions[${actionIndex}]`;
          if (!action || typeof action !== "object") {
            problems.push(`${actionAt}: must be { at, id }`);
            return;
          }
          if (typeof action.at !== "number" || !(action.at >= 0)) {
            problems.push(`${actionAt}: "at" must be a non-negative number`);
          }
          if (!ACTIONS.includes(action.id)) {
            problems.push(
              `${actionAt}: "id" must be one of ${ACTIONS.join(", ")}`,
            );
          }
        });
      }
    }

    if (scene.props !== undefined) {
      if (!Array.isArray(scene.props)) {
        problems.push(`${at}: "props" must be an array of prop ids`);
      } else if (scene.props.length > 2) {
        problems.push(`${at}: at most 2 props per scene`);
      } else {
        scene.props.forEach((prop, propIndex) => {
          if (!PROP_IDS.includes(prop)) {
            problems.push(
              `${at}, props[${propIndex}]: must be one of ${PROP_IDS.join(", ")}`,
            );
          }
        });
      }
    }

    if (scene.guest !== undefined) {
      if (!scene.guest || typeof scene.guest !== "object") {
        problems.push(`${at}: "guest" must be { name, at?, exit?, enter? }`);
      } else {
        if (typeof scene.guest.name !== "string" || scene.guest.name.trim() === "") {
          problems.push(`${at}, guest: "name" must be a non-empty string`);
        }
        if (
          scene.guest.enter !== undefined &&
          !GUEST_ENTRANCES.includes(scene.guest.enter)
        ) {
          problems.push(
            `${at}, guest: "enter" must be one of ${GUEST_ENTRANCES.join(", ")}`,
          );
        }
      }
    }
  });

  if (problems.length > 0) {
    fail(`\n  - ${problems.join("\n  - ")}`);
  }

  // Keep the fixed narration voice unless the workflow overrides it.
  if (process.env.VOICE && process.env.VOICE.trim() !== "") {
    script.voice = process.env.VOICE.trim();
  }

  // Last safety net: any scene that arrived without acting gets the same
  // detection the text pipeline uses, so a hand-written JSON can never render
  // a frozen stickman.
  applyDetection(script.scenes, { title: script.title });

  await fs.writeFile(TARGET, `${JSON.stringify(script, null, 2)}\n`);

  const seconds = script.scenes.reduce(
    (sum, scene) => sum + (Number(scene.duration) || 0),
    0,
  );
  console.log(
    `script written: ${script.scenes.length} scenes, ~${seconds.toFixed(1)}s minimum, ` +
      `voice ${script.voice ?? "(default)"}`,
  );
};

main().catch((error) => fail(error?.message ?? String(error)));
