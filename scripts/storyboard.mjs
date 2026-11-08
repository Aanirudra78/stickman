/**
 * Storyboard: the acting plan for a script, before anything is rendered.
 *
 *   node scripts/storyboard.mjs --text-file=notes.txt
 *   SCRIPT_TEXT="..." node scripts/storyboard.mjs
 *   echo "..." | node scripts/storyboard.mjs
 *   node scripts/storyboard.mjs --script=public/script.json
 *
 * Prints one row per scene: when it starts, the caption, the spoken word that
 * triggers each action, the props, and who visits. If `public/script.json` has
 * generated narration, real timings are used and the row is marked `synced`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScript, countWords } from "../studio/split.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MANIFEST = path.join(ROOT, "src", "voice", "manifest.json");

const arg = (name) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const readText = async () => {
  const scriptFile = arg("script");
  if (scriptFile) {
    const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), scriptFile), "utf8"));
    return (raw.scenes ?? []).map((scene) => scene.voiceover ?? scene.text).join("\n");
  }
  const file = arg("text-file");
  if (file) return fs.readFile(path.resolve(process.cwd(), file), "utf8");
  if (process.env.SCRIPT_TEXT) return process.env.SCRIPT_TEXT;
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const readManifest = async () => {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf8"));
  } catch {
    return null;
  }
};

const pad = (value, width) => {
  const text = String(value);
  return text.length > width ? `${text.slice(0, width - 1)}~` : text.padEnd(width);
};

const clock = (seconds) => {
  const whole = Math.max(0, seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
};

const wordAt = (text, index) => {
  if (index === undefined || index < 0) return "";
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  return words[index] ?? "";
};

const main = async () => {
  const text = (await readText()).trim();
  if (!text) {
    console.error("storyboard: no text (use --text-file=, --script=, SCRIPT_TEXT or stdin)");
    process.exit(1);
  }

  const { script, stats } = buildScript(text, { title: arg("title") });
  const manifest = await readManifest();

  const synced =
    Array.isArray(manifest?.scenes) &&
    manifest.scenes.length === script.scenes.length &&
    manifest.scenes.every(
      (scene, index) => scene.text === (script.scenes[index].voiceover ?? "").trim(),
    );

  // Same sizing rule as the renderer (`getSceneWindows`): speech wins, with a
  // 0.45s tail and at most 0.6s of extra hold over the pre-audio estimate.
  const TAIL = 0.45;
  const HOLD = 0.6;
  let cursor = 0;
  const rows = script.scenes.map((scene, index) => {
    const voice = synced ? manifest.scenes[index] : null;
    const speechEnd = voice?.words?.length
      ? voice.words[voice.words.length - 1].end
      : undefined;
    const seconds =
      speechEnd === undefined
        ? scene.duration
        : Math.max(
            speechEnd + TAIL,
            Math.min(scene.duration, speechEnd + TAIL + HOLD),
          );
    const start = cursor;
    cursor += seconds;

    const actions = (scene.actions ?? [])
      .map((action) => {
        const word = wordAt(scene.voiceover, action.word);
        return word ? `${action.id} @ "${word}"` : `${action.id} @ ${action.at.toFixed(1)}s`;
      })
      .join(" + ");

    const guest = scene.guest
      ? `${scene.guest.name} @ "${wordAt(scene.voiceover, scene.guest.word) || `${scene.guest.at ?? 0.25}s`}"`
      : "-";

    return { start, seconds, scene, actions, guest };
  });

  const title = script.title || "Untitled";
  console.log("");
  console.log(`STICKMAN STORYBOARD - ${title}`);
  console.log(
    `${script.scenes.length} scenes | ${stats.words} words | ~${cursor.toFixed(1)}s | ` +
      `${synced ? "synced to generated voice" : "estimated (no matching voice yet)"}`,
  );
  console.log("");
  console.log(
    `${pad("#", 4)}${pad("START", 8)}${pad("LEN", 6)}${pad("CAPTION / NARRATION", 44)}${pad(
      "ACTING",
      30,
    )}${pad("PROPS", 16)}GUEST`,
  );
  console.log(
    `${"-".repeat(4)}${"-".repeat(8)}${"-".repeat(6)}${"-".repeat(44)}${"-".repeat(30)}${"-".repeat(
      16,
    )}${"-".repeat(18)}`,
  );

  rows.forEach(({ start, seconds, scene, actions, guest }, index) => {
    const line = scene.text || scene.voiceover || "";
    console.log(
      `${pad(index + 1, 4)}${pad(clock(start), 8)}${pad(`${seconds.toFixed(1)}s`, 6)}${pad(
        line.replace(/\n/g, " / "),
        44,
      )}${pad(actions || "(pose only)", 30)}${pad((scene.props ?? []).join(",") || "-", 16)}${guest}`,
    );
  });

  const counts = new Map();
  for (const scene of script.scenes) {
    for (const action of scene.actions ?? []) {
      counts.set(action.id, (counts.get(action.id) ?? 0) + 1);
    }
  }
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${id} x${n}`)
    .join(", ");
  console.log("");
  console.log(`gestures: ${summary || "none"}`);
  if (synced) {
    console.log("word-accurate: actions and guests start on the real spoken word.");
  } else {
    console.log("run npm run voiceover to lock the beats to the real audio.");
  }
  console.log("");
};

main().catch((error) => {
  console.error(`storyboard failed: ${error?.message ?? error}`);
  process.exit(1);
});
