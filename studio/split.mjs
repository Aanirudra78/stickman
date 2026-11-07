/**
 * Turns a pasted script into the scene list the renderer expects.
 *
 *   node studio/split.mjs --text-file=notes.txt --out=public/script.json
 *   SCRIPT_TEXT="..." node studio/split.mjs --out=script.json
 *   echo "..." | node studio/split.mjs --out=script.json
 *
 * Used by the Studio server, the CLI and the GitHub Actions workflow, so all
 * three produce exactly the same JSON.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyDetection } from "../shared/detect.mjs";

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu;
const MAX_SCENES = 12;
const TARGET_CHUNK_WORDS = 26;
const MAX_CHUNK_WORDS = 38;
const MAX_CHUNK_SECONDS = 9.5;
const WPS = 2.6;
const MAX_ITEMS = 4;

export const countWords = (text) => (text.match(WORD_RE) ?? []).length;

/** Rough narration length - the renderer stretches scenes to the real audio. */
export const estimateSeconds = (text) =>
  Math.max(1.6, countWords(text) / WPS + 0.5);

const round = (value) => Math.round(value * 10) / 10;

const stripBullet = (line) => line.replace(/^([-\u2013\u2014*\u2022]|\d{1,2}[.)])\s+/, "").trim();

const isBullet = (line) => /^([-\u2013\u2014*\u2022]|\d{1,2}[.)])\s+/.test(line);

const splitSentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?\u2026])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const POSE_RULES = [
  { test: /\b(why|how|what|kya|kaise|kyu|kyun|kab|kahan|which|who)\b/i, pose: "thinking" },
  { test: /\b(scam|fraud|warning|danger|mistake|never|shock|trapped|loss|lost|risk|illegal)\b/i, pose: "surprised" },
  { test: /\b(win|won|profit|success|result|better|easy|simple|happy|grow|growth|rich|save)\b/i, pose: "happy" },
  { test: /(\d|%|\u20b9|\$|percent)/, pose: "pointing" },
];

const poseFor = (text, { isTitle = false, isLast = false, sceneType = "text" } = {}) => {
  if (isTitle) return "idle";
  if (sceneType === "points") return "pointing";
  for (const rule of POSE_RULES) {
    if (rule.test.test(text)) return rule.pose;
  }
  if (isLast) return "happy";
  return "talking";
};

/** Short on-screen caption for a scene (the full sentence goes to the voice). */
const displayText = (narration) => {
  const first = splitSentences(narration)[0] ?? narration;
  let text = first.replace(/[.!?\u2026]+$/, "").trim();
  if (text.length > 62) {
    const cut = text.slice(0, 62);
    const space = cut.lastIndexOf(" ");
    text = `${cut.slice(0, space > 30 ? space : 62).trim()}\u2026`;
  }
  return text;
};

const ensurePeriod = (text) => {
  const trimmed = text.trim().replace(/[.!?\u2026]+$/, "");
  return trimmed.length > 0 ? `${trimmed}.` : "";
};

/** Groups sentences into ~6-9 second narration blocks. */
const chunkSentences = (sentences) => {
  const chunks = [];
  let current = [];
  let words = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current.join(" "));
      current = [];
      words = 0;
    }
  };

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    const wouldBeWords = words + sentenceWords;
    const wouldBeSeconds = estimateSeconds([...current, sentence].join(" "));

    if (current.length > 0 && (wouldBeWords > MAX_CHUNK_WORDS || wouldBeSeconds > MAX_CHUNK_SECONDS)) {
      flush();
    }
    current.push(sentence);
    words += sentenceWords;

    if (words >= TARGET_CHUNK_WORDS) flush();
  }
  flush();

  // Fold a tiny trailing chunk into the previous one.
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    const prev = chunks[chunks.length - 2];
    if (countWords(last) < 4 && countWords(prev) + countWords(last) <= MAX_CHUNK_WORDS) {
      chunks.splice(chunks.length - 2, 2, `${prev} ${last}`);
    }
  }

  return chunks;
};

const mergeToLimit = (scenes) => {
  const output = scenes.slice();
  while (output.length > MAX_SCENES) {
    let bestIndex = -1;
    let bestWords = Infinity;
    for (let i = 0; i < output.length - 1; i++) {
      const a = output[i];
      const b = output[i + 1];
      if (a.scene_type !== "text" || b.scene_type !== "text") continue;
      const words = countWords(a.voiceover) + countWords(b.voiceover);
      if (words < bestWords) {
        bestWords = words;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break;
    const a = output[bestIndex];
    const b = output[bestIndex + 1];
    const voiceover = `${a.voiceover} ${b.voiceover}`;
    output.splice(bestIndex, 2, {
      ...a,
      text: displayText(voiceover),
      voiceover,
      duration: round(estimateSeconds(voiceover)),
    });
  }
  return output;
};

/**
 * @param {string} rawText
 * @param {{ title?: string }} [options]
 */
export const splitScript = (rawText, options = {}) => {
  const text = String(rawText ?? "").replace(/\r\n?/g, "\n").trim();
  if (text.length === 0) {
    throw new Error("script is empty");
  }

  const blocks = text
    .split(/\n\s*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  const scenes = [];
  let title = options.title?.trim() || "";
  let blockIndex = 0;

  // Title: a short first line without sentence punctuation.
  if (blocks.length > 0) {
    const firstLines = blocks[0];
    if (!title && firstLines.length === 1) {
      const line = firstLines[0];
      if (countWords(line) <= 10 && !/[.!?]$/.test(line)) {
        title = line;
        blockIndex = 1;
      }
    } else if (!title && firstLines.length > 1) {
      const line = firstLines[0];
      if (countWords(line) <= 10 && !/[.!?]$/.test(line)) {
        title = line;
        blocks[0] = firstLines.slice(1);
      }
    }
  }

  if (title) {
    scenes.push({
      text: title,
      voiceover: ensurePeriod(title),
      pose: "idle",
      scene_type: "text",
      duration: round(estimateSeconds(title)),
    });
  }

  for (; blockIndex < blocks.length; blockIndex++) {
    let lines = blocks[blockIndex];
    if (lines.length === 0) continue;

    const bulletLines = lines.filter(isBullet);
    if (bulletLines.length >= 2) {
      const heading = lines.filter((line) => !isBullet(line)).join(" ").trim();
      const items = bulletLines.map(stripBullet).filter(Boolean);

      for (let start = 0; start < items.length; start += MAX_ITEMS) {
        const group = items.slice(start, start + MAX_ITEMS);
        const isFirstGroup = start === 0;
        const sceneHeading = isFirstGroup && heading ? heading : isFirstGroup ? "Key points" : "And also";
        const voiceover = [sceneHeading, ...group].map(ensurePeriod).filter(Boolean).join(" ");
        scenes.push({
          text: isFirstGroup ? displayText(sceneHeading) : displayText(group[0]),
          voiceover,
          pose: "pointing",
          scene_type: "points",
          duration: round(estimateSeconds(voiceover)),
              items: group,
        });
      }
      continue;
    }

    const prose = lines.join(" ").replace(/\s+/g, " ").trim();
    if (!prose) continue;

    if (scenes.length === 0) {
      scenes.push({
        text: displayText(prose),
        voiceover: ensurePeriod(prose),
        pose: poseFor(prose),
        scene_type: "text",
        duration: round(estimateSeconds(prose)),
        });
      continue;
    }

    for (const chunk of chunkSentences(splitSentences(prose))) {
      scenes.push({
        text: displayText(chunk),
        voiceover: ensurePeriod(chunk),
        pose: poseFor(chunk),
        scene_type: "text",
        duration: round(estimateSeconds(chunk)),
        });
    }
  }

  if (scenes.length === 0) {
    scenes.push({
      text: displayText(text),
      voiceover: ensurePeriod(text),
      pose: "talking",
      scene_type: "text",
      duration: round(estimateSeconds(text)),
    });
  }

  const limited = mergeToLimit(scenes);

  // Only the last scene may be "happy"; keep title idle.
  limited.forEach((scene, index) => {
    if (scene.scene_type === "points") {
      scene.pose = "pointing";
    } else if (index === 0 && scene.text === title) {
      scene.pose = "idle";
    } else if (index === limited.length - 1) {
      scene.pose = poseFor(scene.voiceover, { isLast: true });
    } else {
      scene.pose = poseFor(scene.voiceover);
    }
  });

  // Actions, props and guest cameos are inferred from the words themselves, so
  // the same pasted script produces the same acting everywhere (Studio, CLI,
  // GitHub Actions). The title scene stays still and prop-free.
  applyDetection(limited, { title });

  const totalSeconds = limited.reduce((sum, scene) => sum + scene.duration, 0);

  return {
    title: title || "Untitled",
    scenes: limited,
    stats: {
      words: limited.reduce((sum, scene) => sum + countWords(scene.voiceover), 0),
      seconds: round(totalSeconds),
      warnings:
        totalSeconds > 75
          ? [`narration is ~${Math.round(totalSeconds)}s - videos work best under 60-75s`]
          : [],
    },
  };
};

/** Full `script.json` object (title + voice + provider settings + scenes). */
export const buildScript = (rawText, options = {}) => {
  const { title, scenes, stats } = splitScript(rawText, options);

  const provider = options.provider ?? (process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "edge");
  const speed = Number.isFinite(Number(options.speed)) ? Number(options.speed) : 0.92;

  const script = {
    title: options.title?.trim() || title,
    voice: undefined,
    tts: {
      provider,
      model: options.model || "eleven_multilingual_v2",
      heavy: options.heavy === undefined ? true : Boolean(options.heavy),
      voiceSettings: {
        stability: 0.45,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true,
        speed,
      },
    },
    scenes,
  };

  if (provider === "edge") {
    script.tts.rate = options.rate || "-4%";
    script.tts.heavy = false;
    // Only Edge ids ("...Neural") make sense here.
    if (options.voice && /Neural$/.test(options.voice)) script.voice = options.voice;
  } else {
    // Only ElevenLabs ids make sense here.
    script.voice =
      options.voice && !/Neural$/.test(options.voice)
        ? options.voice
        : "nPczCjzI2devNBz1zQrb"; // Brian - Deep & Comforting
  }

  return { script, stats };
};

/* ------------------------------------------------------------------ CLI --- */

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const arg = (name) => {
    const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const flag = (name) => process.argv.includes(`--${name}`);

  const readText = async () => {
    const file = arg("text-file");
    if (file) return fs.readFile(path.resolve(process.cwd(), file), "utf8");
    const envName = arg("text-env") ?? "SCRIPT_TEXT";
    if (process.env[envName]) return process.env[envName];
    if (process.stdin.isTTY) return "";
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  };

  const main = async () => {
    const text = (await readText()).trim();
    if (!text) {
      console.error("script error: no text (use --text-file=, SCRIPT_TEXT or stdin)");
      process.exit(1);
    }

    const { script, stats } = buildScript(text, {
      title: arg("title"),
      voice: arg("voice") || process.env.VOICE || undefined,
      provider: arg("provider") || undefined,
      model: arg("model") || undefined,
      speed: arg("speed") || undefined,
      heavy: arg("heavy") === undefined ? undefined : arg("heavy") !== "0",
      rate: arg("rate") || undefined,
    });

    const json = `${JSON.stringify(script, null, 2)}\n`;
    const out = arg("out");
    if (!out || out === "-") {
      process.stdout.write(json);
    } else {
      const target = path.resolve(process.cwd(), out);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, json);
      console.error(`split: ${script.scenes.length} scenes, ~${stats.seconds}s, ${stats.words} words -> ${out}`);
      for (const warning of stats.warnings) console.error(`warning: ${warning}`);
    }
  };

  main().catch((error) => {
    console.error(`split failed: ${error?.message ?? error}`);
    process.exit(1);
  });
}
