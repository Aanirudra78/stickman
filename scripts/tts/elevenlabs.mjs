/**
 * ElevenLabs text-to-speech with character-level timings.
 *
 * `/v1/text-to-speech/{voiceId}/with-timestamps` returns:
 *   - audio_base64  (mp3)
 *   - alignment     (per-character start/end seconds for the text we sent)
 *
 * The alignment is converted to word timings, which is exactly what
 * `src/voice/manifest.json` expects - so lip sync keeps working unchanged.
 */
export const API = "https://api.elevenlabs.io/v1";
export const DEFAULT_MODEL = "eleven_multilingual_v2";
export const OUTPUT_FORMAT = "mp3_44100_128";

export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.8,
  style: 0.3,
  use_speaker_boost: true,
  speed: 0.92,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const round = (value) => Math.round(value * 1000) / 1000;

const readError = async (response) => {
  const text = await response.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    const detail = json.detail ?? json;
    if (typeof detail === "string") return detail;
    return detail.message ?? detail.code ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300) || `HTTP ${response.status}`;
  }
};

/**
 * Groups character timings into words. Punctuation is dropped, apostrophes and
 * hyphens stay inside the word ("don't", "two-minute").
 */
export const wordsFromAlignment = (alignment) => {
  if (!alignment?.characters?.length) return [];

  const characters = alignment.characters;
  const starts = alignment.character_start_times_seconds ?? [];
  const ends = alignment.character_end_times_seconds ?? [];

  const words = [];
  let current = null;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const isLetter = /[\p{L}\p{N}]/u.test(char);
    const isInnerPunctuation = current && /['\u2019-]/u.test(char);

    if (isLetter || isInnerPunctuation) {
      if (!current) {
        current = { text: "", start: starts[i] ?? 0, end: ends[i] ?? starts[i] ?? 0 };
      }
      current.text += char;
      current.end = ends[i] ?? current.end;
    } else if (current) {
      words.push(current);
      current = null;
    }
  }
  if (current) words.push(current);

  return words
    .filter((word) => word.text.trim().length > 0)
    .map((word) => ({
      text: word.text,
      start: round(word.start),
      end: round(word.end),
    }));
};

const request = async (url, options, { attempts = 3 } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      const message = await readError(response);
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`ElevenLabs ${response.status}: ${message}`);
        await sleep(1000 * attempt);
        continue;
      }
      throw new Error(`ElevenLabs ${response.status}: ${message}`);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(700 * attempt);
      else throw error;
    }
  }
  throw lastError;
};

/**
 * @returns {Promise<{ audio: Buffer, words: Array<{text,start,end}>, duration?: number }>}
 */
export const synthesize = async ({
  text,
  voiceId,
  apiKey,
  model = DEFAULT_MODEL,
  voiceSettings = {},
  outputFormat = OUTPUT_FORMAT,
}) => {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing");
  if (!voiceId) throw new Error("ElevenLabs voice id is missing");

  const settings = { ...DEFAULT_VOICE_SETTINGS, ...voiceSettings };
  const body = {
    text,
    model_id: model,
    voice_settings: settings,
  };

  const url = `${API}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${outputFormat}`;
  const headers = {
    "xi-api-key": apiKey,
    "content-type": "application/json",
    accept: "application/json",
  };

  let response;
  try {
    response = await request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Older models reject `speed`; retry without it instead of failing the job.
    if (/speed|voice_settings/i.test(error.message)) {
      delete body.voice_settings.speed;
      response = await request(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } else {
      throw error;
    }
  }

  const json = await response.json();
  const audio = Buffer.from(json.audio_base64 ?? "", "base64");
  if (audio.length < 1024) {
    throw new Error("ElevenLabs returned empty audio");
  }

  // `alignment` follows the text we sent; `normalized_alignment` can rewrite
  // numbers ("2" -> "two") which breaks item matching in the timeline.
  const alignment = json.alignment ?? json.normalized_alignment;
  const words = wordsFromAlignment(alignment);
  const duration = words.length > 0 ? words[words.length - 1].end : undefined;

  return { audio, words, duration };
};

export const listVoices = async (apiKey) => {
  const response = await request(`${API}/v2/voices?page_size=100`, {
    headers: { "xi-api-key": apiKey },
  });
  const json = await response.json();
  return (json.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    category: voice.category,
    labels: voice.labels ?? {},
    preview: voice.preview_url,
  }));
};

export const getSubscription = async (apiKey) => {
  const response = await request(`${API}/user/subscription`, {
    headers: { "xi-api-key": apiKey },
  });
  const json = await response.json();
  return {
    tier: json.tier,
    status: json.status,
    used: json.character_count,
    limit: json.character_limit,
    resetsAt: json.next_character_count_reset_unix
      ? new Date(json.next_character_count_reset_unix * 1000).toISOString()
      : null,
  };
};
