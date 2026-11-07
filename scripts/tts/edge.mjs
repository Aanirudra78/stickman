/**
 * Microsoft Edge neural TTS (free, no key). Kept as the offline/fallback
 * provider: same manifest schema, real word-boundary timings.
 *
 * Note: Edge's terms do not cover commercial resale. Use ElevenLabs (paid plan)
 * or another licensed provider before selling the output.
 */
import edgeTts from "@andresaya/edge-tts";

const { EdgeTTS } = edgeTts;

export const DEFAULT_VOICE = "en-US-AndrewMultilingualNeural";
export const DEFAULT_RATE = "-4%";
export const DEFAULT_PITCH = "+0Hz";
export const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 1000) / 1000;

const looksLikeMp3 = (buffer) => {
  if (buffer.length < 1024) return false;
  if (buffer.subarray(0, 3).toString("latin1") === "ID3") return true;
  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
};

export const createEdge = ({
  voice = DEFAULT_VOICE,
  rate = DEFAULT_RATE,
  pitch = DEFAULT_PITCH,
  outputFormat = OUTPUT_FORMAT,
} = {}) => {
  const tts = new EdgeTTS();

  const synthesize = async (text) => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await tts.generate(text, voice, {
          rate,
          pitch,
          outputFormat,
          timeout: 60000,
        });
        const audio = Buffer.from(result.audio);
        if (!looksLikeMp3(audio)) {
          throw new Error(`response is not an MP3 (${audio.length} bytes)`);
        }
        const words = (result.wordBoundaries ?? []).map((word) => ({
          text: word.text,
          start: round(word.offset / 1e7),
          end: round((word.offset + word.duration) / 1e7),
        }));
        return { audio, words, duration: result.duration };
      } catch (error) {
        lastError = error;
        if (attempt < 3) await sleep(700 * attempt);
      }
    }
    throw lastError;
  };

  return {
    name: "edge",
    label: "Microsoft Edge (free)",
    voice,
    rateLabel: rate,
    pitch,
    outputFormat,
    sampleRate: 24000,
    bitrate: "96k",
    cacheKey: `edge|${voice}|${rate}|${pitch}|${outputFormat}`,
    synthesize,
  };
};
