/**
 * Phase 5C: word-accurate lip sync.
 *
 * The old mouth was a canned 4-value loop that ran whenever the scene had a
 * voice - it moved, but never with the words. This module turns the narration
 * word timings (Edge or ElevenLabs, both write `words[]` with start/end into
 * the voice manifest) into a mouth curve:
 *
 *   - inside a word: one open/close cycle per syllable, so the jaw matches the
 *     rhythm of what is being said,
 *   - between words and in pauses: mouth shut,
 *   - vowel colour narrows or widens the mouth (round "o/oo" vs wide "a/e/i").
 *
 * Everything is a pure function of seconds + timings, so the same script and
 * the same audio always draw the same mouth.
 */

export type MouthShape = {
  /** 0 = closed line, 1 = full "O". */
  open: number;
  /** Multiplier on the resting mouth width. */
  width: number;
};

const CLOSED: MouthShape = { open: 0.04, width: 1 };

const VOWELS = "aeiouy";

/** Rough syllable count: vowel groups, with a floor of one. */
export const syllableCount = (word: string): number => {
  const lower = word.toLowerCase();
  let groups = 0;
  let inGroup = false;
  for (const char of lower) {
    const vowel = VOWELS.includes(char);
    if (vowel && !inGroup) groups += 1;
    inGroup = vowel;
  }
  // A word ending in a silent "e" ("care") reads as one syllable, not two.
  if (groups > 1 && lower.endsWith("e") && !VOWELS.includes(lower[lower.length - 2] ?? "")) {
    groups -= 1;
  }
  return Math.max(1, groups);
};

/** Round vowels pull the mouth in, wide vowels spread it. */
const widthForWord = (word: string): number => {
  const lower = word.toLowerCase();
  if (/[oou]/.test(lower)) return 0.86;
  if (/[aei]/.test(lower)) return 1.14;
  return 1;
};

export type WordSpan = { text: string; start: number; end: number };

const smoothstep = (value: number): number => {
  const p = Math.min(1, Math.max(0, value));
  return p * p * (3 - 2 * p);
};

/**
 * Mouth shape at `seconds` (scene-local) from the scene's word timings.
 * Returns CLOSED outside every word. `fallback` is used when the manifest has
 * no timings for this scene, so untimed voices still get a talking mouth.
 */
export const mouthAt = (
  words: readonly WordSpan[] | undefined,
  seconds: number,
  fallback?: () => number,
): MouthShape => {
  if (!words || words.length === 0) {
    return fallback ? { open: fallback(), width: 1 } : CLOSED;
  }

  for (const span of words) {
    if (seconds < span.start - 0.04 || seconds > span.end + 0.06) continue;
    // Word envelope: the jaw opens on the vowel and closes before the next
    // word, so the mouth is never open through a pause.
    const spanStart = span.start - 0.04;
    const spanEnd = span.end + 0.06;
    const progress = Math.min(1, Math.max(0, (seconds - spanStart) / (spanEnd - spanStart)));
    const syllables = syllableCount(span.text);
    const envelope = Math.sin(Math.PI * progress) ** 0.45;
    const pulse = Math.abs(Math.sin(Math.PI * syllables * progress)) ** 1.35;
    const amplitude = 0.42 + Math.min(0.3, (syllables - 1) * 0.12);
    // Close the jaw a touch between syllables: the pulse already does this,
    // the smoothstep keeps the shape from reading as a machine.
    const open = smoothstep(pulse) * (0.55 + 0.45 * envelope) * amplitude;
    return { open, width: widthForWord(span.text) };
  }

  return CLOSED;
};
