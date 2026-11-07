/**
 * Voice provider switch.
 *
 *   elevenlabs  -> best quality, needs ELEVENLABS_API_KEY (10k free chars/month)
 *   edge        -> free, unlimited, no key (fallback)
 *
 * Both return the same shape, so `scripts/generate-voiceover.mjs` does not
 * care which one is active.
 */
import { createEdge, DEFAULT_VOICE as EDGE_DEFAULT_VOICE } from "./edge.mjs";
import {
  DEFAULT_MODEL,
  DEFAULT_VOICE_SETTINGS,
  OUTPUT_FORMAT as ELEVEN_FORMAT,
  synthesize as elevenSynthesize,
} from "./elevenlabs.mjs";

export const DEFAULT_ELEVEN_VOICE = "nPczCjzI2devNBz1zQrb"; // Brian - Deep & Comforting

/**
 * Verified to work on the free plan (premade voices). Voice Library voices are
 * marked `paid` - the API rejects those with 402 until the plan is upgraded.
 */
export const ELEVEN_VOICES = [
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian - Deep, Resonant & Comforting (default)", tag: "deep" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill - Wise, Mature, Balanced", tag: "narrator" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam - Dominant & Firm", tag: "deep" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric - Smooth & Trustworthy", tag: "explainer" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger - Laid-Back, Resonant", tag: "storytelling" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George - Warm Storyteller (British)", tag: "storytelling" },
  { id: "jWu9BIg1r9UOe2ivl02q", name: "Ron Sage - Warm, Soulful & Conversation", tag: "storytelling", paid: true },
  { id: "t1yzxMpe9zK42bXmI1T2", name: "K. V. Hagen - Deep Warm Narrator", tag: "deep", paid: true },
  { id: "3YzGaTGef0x5PLEK9yGq", name: "Atlas - Deep & Gravelly", tag: "documentary", paid: true },
  { id: "JJCR1UICgHnHljtvu5uF", name: "Don - Movie Trailer", tag: "trailer", paid: true },
];

export const EDGE_VOICES = [
  { id: "en-US-AndrewMultilingualNeural", name: "Andrew - Multilingual (default)", lang: "en-US" },
  { id: "en-US-BrianNeural", name: "Brian - Deep, Resonant", lang: "en-US" },
  { id: "en-US-ChristopherNeural", name: "Christopher - Reflective", lang: "en-US" },
  { id: "en-US-EricNeural", name: "Eric - Smooth", lang: "en-US" },
  { id: "en-US-GuyNeural", name: "Guy - Lively", lang: "en-US" },
  { id: "en-US-JennyNeural", name: "Jenny - Friendly", lang: "en-US" },
  { id: "en-GB-RyanNeural", name: "Ryan - British", lang: "en-GB" },
  { id: "hi-IN-MadhurNeural", name: "Madhur - Hindi", lang: "hi-IN" },
  { id: "hi-IN-SwaraNeural", name: "Swara - Hindi (female)", lang: "hi-IN" },
];

const createElevenLabs = ({
  apiKey,
  voice,
  model,
  voiceSettings,
  heavy,
}) => ({
  name: "elevenlabs",
  label: "ElevenLabs",
  voice,
  model,
  rateLabel: `speed ${voiceSettings.speed ?? DEFAULT_VOICE_SETTINGS.speed}`,
  pitch: "",
  outputFormat: ELEVEN_FORMAT,
  // 44.1 kHz source: keep it, do not downsample to Edge's 24 kHz.
  sampleRate: 44100,
  bitrate: "128k",
  heavy: heavy !== false,
  cacheKey: `elevenlabs|${voice}|${model}|${JSON.stringify(voiceSettings)}`,
  synthesize: (text) =>
    elevenSynthesize({ text, voiceId: voice, apiKey, model, voiceSettings }),
});

/**
 * @param {object} settings
 * @param {"elevenlabs"|"edge"} [settings.provider]
 * @param {string} [settings.apiKey]
 * @param {string} [settings.voice]
 * @param {string} [settings.model]
 * @param {object} [settings.voiceSettings]
 * @param {boolean} [settings.heavy]
 * @param {string} [settings.rate]  Edge rate, e.g. "-4%"
 */
export const createProvider = (settings = {}) => {
  const apiKey = (settings.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "").trim();
  const requested = settings.provider ?? (apiKey ? "elevenlabs" : "edge");

  if (requested === "elevenlabs") {
    if (!apiKey) {
      console.warn("! ELEVENLABS_API_KEY not set - falling back to Microsoft Edge TTS");
    } else {
      return createElevenLabs({
        apiKey,
        // An Edge voice id ("...Neural") is not valid here.
        voice:
          settings.voice && !/Neural$/.test(settings.voice)
            ? settings.voice
            : DEFAULT_ELEVEN_VOICE,
        model: settings.model || DEFAULT_MODEL,
        voiceSettings: { ...DEFAULT_VOICE_SETTINGS, ...(settings.voiceSettings ?? {}) },
        heavy: settings.heavy,
      });
    }
  }

  return createEdge({
    // An ElevenLabs id (20 chars, no "Neural") is not valid here.
    voice: settings.voice && /Neural$/.test(settings.voice) ? settings.voice : EDGE_DEFAULT_VOICE,
    rate: settings.rate || "-4%",
  });
};

export { DEFAULT_MODEL, DEFAULT_VOICE_SETTINGS, EDGE_DEFAULT_VOICE };
