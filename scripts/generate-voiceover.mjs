/**
 * Generates the voiceover for `public/script.json`.
 *
 *   npm run voiceover                    # only synthesize new/changed lines
 *   npm run voiceover -- --force         # re-synthesize everything
 *   npm run voiceover -- --provider=edge # override the script's provider
 *
 * Provider is chosen from `script.json` -> `tts.provider` (falls back to
 * elevenlabs when ELEVENLABS_API_KEY exists, otherwise Microsoft Edge TTS).
 *
 * Outputs:
 *   public/voice/scene-01.mp3 ...   played by <Audio> in the composition
 *   src/voice/manifest.json         durations + word timings, imported by TS
 *
 * Everything is cached by a hash of (provider + voice + settings + text), so
 * re-running is cheap and only pays for lines that actually changed.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createProvider } from "./tts/index.mjs";
import { HEAVY_CHAIN, ROOT, processClip, probeDuration, round } from "./audio.mjs";

const SCRIPT_PATH = path.join(ROOT, "public", "script.json");
const AUDIO_DIR = path.join(ROOT, "public", "voice");
const MANIFEST_PATH = path.join(ROOT, "src", "voice", "manifest.json");

/** Peak-normalize every clip so the voice sits at a normal social-video level. */
const TARGET_PEAK_DBFS = -3;
const MAX_GAIN_DB = 12;

const force = process.argv.includes("--force");
const providerArg = process.argv.find((arg) => arg.startsWith("--provider="))?.split("=")[1];

const sha1 = (value) => createHash("sha1").update(value).digest("hex").slice(0, 12);

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

/**
 * Safety net when a provider returns audio without word timings: spread the
 * words evenly over the clip so lip sync degrades instead of breaking.
 */
const estimateWords = (text, duration) => {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !duration) return [];
  const step = duration / tokens.length;
  return tokens.map((token, index) => ({
    text: token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || token,
    start: round(index * step),
    end: round((index + 1) * step * 0.92),
  }));
};

const main = async () => {
  const script = JSON.parse(await fs.readFile(SCRIPT_PATH, "utf8"));
  const scenes = Array.isArray(script.scenes) ? script.scenes : [];
  if (scenes.length === 0) {
    throw new Error("public/script.json has no scenes");
  }

  const missing = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => typeof scene.voiceover !== "string" || scene.voiceover.trim() === "");
  if (missing.length > 0) {
    throw new Error(
      `scenes without a "voiceover" field: ${missing.map((m) => m.index + 1).join(", ")}. ` +
        `Add narration text (or delete the scene) before generating audio.`,
    );
  }

  const ttsConfig = script.tts ?? {};
  const provider = createProvider({
    provider: providerArg ?? ttsConfig.provider,
    voice: ttsConfig.voice ?? script.voice,
    model: ttsConfig.model,
    voiceSettings: ttsConfig.voiceSettings,
    heavy: ttsConfig.heavy,
    rate: ttsConfig.rate,
  });

  const chain = provider.heavy ? HEAVY_CHAIN : "";
  const previous = await readJson(MANIFEST_PATH, { scenes: [] });
  const previousByIndex = new Map((previous.scenes ?? []).map((s) => [s.index, s]));

  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const generated = [];

  console.log(
    `provider: ${provider.name}   voice: ${provider.voice}   ` +
      `${provider.model ? `model: ${provider.model}   ` : ""}` +
      `heavy: ${provider.heavy ? "on" : "off"}   scenes: ${scenes.length}\n`,
  );

  for (let index = 0; index < scenes.length; index++) {
    const text = scenes[index].voiceover.trim();
    const file = `voice/scene-${String(index + 1).padStart(2, "0")}.mp3`;
    const absolute = path.join(ROOT, "public", file);
    const hash = sha1(
      `${provider.cacheKey}|${chain}|${TARGET_PEAK_DBFS}|${provider.sampleRate}|${provider.bitrate}|${text}`,
    );

    const cached = previousByIndex.get(index);
    const onDisk = await fs
      .stat(absolute)
      .then((stat) => stat.size)
      .catch(() => 0);

    if (!force && cached && cached.hash === hash && onDisk > 0) {
      generated.push({ ...cached, file, text, cached: true });
      console.log(
        `${String(index + 1).padStart(2, "0")}  cached   ${cached.durationInSeconds.toFixed(2)}s  ${text}`,
      );
      continue;
    }

    const result = await provider.synthesize(text);
    await fs.writeFile(absolute, result.audio);

    // Loudness + optional "heavy" shaping in one pass - never touches timing.
    const processing = await processClip(absolute, {
      targetPeakDbfs: TARGET_PEAK_DBFS,
      maxGainDb: MAX_GAIN_DB,
      chain,
      sampleRate: provider.sampleRate,
      bitrate: provider.bitrate,
    });

    const measured = await probeDuration(absolute);
    const fallbackDuration =
      result.duration && result.duration > 0 ? result.duration : undefined;
    const duration = measured ?? fallbackDuration ?? 0;

    let words = result.words ?? [];
    // Drop the small silence the model sometimes puts before the first word.
    if (words.length > 0 && words[0].start > 0.4) {
      const shift = words[0].start - 0.08;
      words = words.map((word) => ({
        ...word,
        start: round(Math.max(0, word.start - shift)),
        end: round(Math.max(0.02, word.end - shift)),
      }));
    }
    if (words.length === 0) {
      words = estimateWords(text, duration);
    }

    const entry = {
      index,
      file,
      text,
      hash,
      durationInSeconds: round(
        duration || (words[words.length - 1]?.end ?? 0) + 0.15,
      ),
      peakDbfs: processing.peakDbfs,
      gainDb: processing.gainDb,
      words,
    };

    const size = (await fs.stat(absolute)).size;
    generated.push(entry);
    console.log(
      `${String(index + 1).padStart(2, "0")}  created  ${entry.durationInSeconds.toFixed(2)}s  ` +
        `${(size / 1024).toFixed(1)} KB  ` +
        `${processing.gainDb >= 0.5 ? `+${processing.gainDb} dB` : "no gain"}  ` +
        `${words.length} words  ${text}`,
    );
  }

  const totalSeconds = round(
    generated.reduce((sum, scene) => sum + scene.durationInSeconds, 0),
  );

  const manifest = {
    provider: provider.name,
    voice: provider.voice,
    model: provider.model,
    rate: provider.rateLabel,
    pitch: provider.pitch,
    outputFormat: provider.outputFormat,
    heavy: provider.heavy,
    normalization: { targetPeakDbfs: TARGET_PEAK_DBFS, maxGainDb: MAX_GAIN_DB },
    generatedAt: new Date().toISOString(),
    totalSeconds,
    scenes: generated.map(({ cached: _cached, ...scene }) => scene),
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `\ntotal narration: ${totalSeconds.toFixed(2)}s  ->  ${MANIFEST_PATH.replace(ROOT + path.sep, "")}`,
  );
  console.log(`files: ${AUDIO_DIR.replace(ROOT + path.sep, "")}`);
};

main().catch((error) => {
  console.error(`\nvoiceover generation failed: ${error?.message ?? error}`);
  process.exit(1);
});
