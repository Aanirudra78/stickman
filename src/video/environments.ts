/**
 * Scene environments: the world each scene plays in.
 *
 * Every scene gets a deterministic environment picked from its own words
 * (study lines land in a study, money lines in an office, sleep lines under a
 * night sky...), so the film feels directed instead of random. Selection is
 * pure data -> same script, same film, every render.
 *
 * CONTRAST CONTRACT (do not break):
 *   - The caption zone (y 250..810) stays LIGHT in every environment, so the
 *     dark scene text keeps its contrast and the pixel probes never read the
 *     wall as ink.
 *   - Strong colours and silhouettes live low (y > 1100), around the stage.
 *   - The character stands on a soft light "stage glow" drawn by Background.
 */

export type EnvId = "study" | "office" | "duskCity" | "park" | "dreamNight";

export const ENV_IDS: readonly EnvId[] = [
  "study",
  "office",
  "duskCity",
  "park",
  "dreamNight",
];

/** Fallback cycle when no keyword matches - never the same env twice in a row. */
const CYCLE: readonly EnvId[] = ["study", "park", "office", "duskCity"];

const ENV_RULES: readonly (readonly [EnvId, readonly string[]])[] = [
  [
    "study",
    [
      "study",
      "studi*",
      "padhai",
      "exam",
      "exams",
      "school",
      "college",
      "learn",
      "book",
      "read",
      "homework",
      "practice",
      "revision",
      "topper",
      "marks",
      "test",
    ],
  ],
  [
    "office",
    [
      "work",
      "office",
      "job",
      "money",
      "paisa",
      "business",
      "company",
      "laptop",
      "meeting",
      "boss",
      "salary",
      "career",
      "hustle",
      "focus",
      "deadline",
      "client",
      "startup",
      "sale",
      "sell",
      "market",
    ],
  ],
  [
    "duskCity",
    [
      "city",
      "street",
      "evening",
      "dusk",
      "sunset",
      "evening walk",
      "return",
      "laut",
      "traffic",
      "crowd",
      "world",
      "duniya",
      "life",
      "zindagi",
    ],
  ],
  [
    "dreamNight",
    [
      "night",
      "raat",
      "sleep",
      "so",
      "so gaya",
      "dream",
      "sapna",
      "sapne",
      "rest",
      "tired",
      "thak",
      "peace",
      "shanti",
      "stars",
      "midnight",
      "late",
    ],
  ],
  [
    "park",
    [
      "morning",
      "subah",
      "walk",
      "park",
      "garden",
      "sun",
      "fresh",
      "health",
      "sehat",
      "run",
      "exercise",
      "nature",
      "tree",
      "outside",
      "bahar",
      "happy",
      "khush",
    ],
  ],
];

/**
 * The environment for a scene. Keyword match first (text + items, case-free
 * whole-word-ish), then a deterministic cycle that avoids repeating the
 * previous scene's environment.
 */
export const pickEnvironment = (
  text: string,
  items: readonly string[] | undefined,
  sceneIndex: number,
  previous?: EnvId,
): EnvId => {
  const haystack = [text, ...(items ?? [])]
    .join(" ")
    .toLowerCase();
  for (const [id, words] of ENV_RULES) {
    if (
      words.some((word) => {
        if (word.includes(" ")) return haystack.includes(word);
        // "stem*" = prefix match (matches "study", "studied", "studying").
        if (word.endsWith("*")) {
          return haystack.match(new RegExp(`\\b${word.slice(0, -1)}`)) !== null;
        }
        return haystack.match(new RegExp(`\\b${word}\\b`)) !== null;
      })
    ) {
      return id;
    }
  }
  // Deterministic cycle, skipping the previous environment.
  let offset = sceneIndex % CYCLE.length;
  if (CYCLE[offset] === previous) {
    offset = (offset + 1) % CYCLE.length;
  }
  return CYCLE[offset];
};

/** "#RRGGBB" -> "rgba(r, g, b, alpha)" - used for environment light tints. */
export const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/* ------------------------------------------------------------------ mood --- */

/**
 * Phase 4: light that lives ON the AI plate - lamp pools, window shafts and
 * neon accents, all deterministic (animated from t, never wall-clock).
 * Everything sits below y ~1500 around the stage: the caption band keeps the
 * CONTRAST CONTRACT, and the caption scrim in Background sits on top anyway.
 */
export type MoodLight = {
  /** Centre in full-res 1080x1920 coords. */
  x: number;
  y: number;
  /** Radius in px. */
  r: number;
  /** Base colour as "#RRGGBB". */
  color: string;
  /** Peak alpha of the pool (breathes around this). */
  alpha: number;
  /** Breathing rate in rad/s - incommensurate per light so they never sync. */
  breath: number;
  phase: number;
  /** Deterministic flicker depth 0..1 (neon buzz, cheap lamp). 0 = steady. */
  flicker?: number;
};

export type EnvMood = {
  pools: readonly MoodLight[];
  /** A window light shaft: a soft rotated gradient. */
  shaft?: {
    x: number;
    y: number;
    w: number;
    h: number;
    angle: number;
    color: string;
    alpha: number;
  };
};

export const ENV_MOODS: Record<EnvId, EnvMood> = {
  study: {
    pools: [
      // Warm desk-lamp pool over the desk (lower-left).
      { x: 300, y: 1280, r: 340, color: "#FFD9A0", alpha: 0.3, breath: 0.9, phase: 0.4, flicker: 0.05 },
      // Soft window daylight on the right wall.
      { x: 940, y: 1180, r: 300, color: "#FFF6E0", alpha: 0.22, breath: 0.7, phase: 2.1 },
    ],
    shaft: { x: 900, y: 980, w: 240, h: 760, angle: 24, color: "#FFF3D6", alpha: 0.14 },
  },
  office: {
    pools: [
      // Cool daylight wash over the centre of the room.
      { x: 560, y: 1320, r: 460, color: "#EAF4FF", alpha: 0.26, breath: 0.5, phase: 1.2 },
      // Subtle cobalt accent from the whiteboard side.
      { x: 850, y: 1420, r: 300, color: "#9DBFFF", alpha: 0.16, breath: 0.8, phase: 3.4 },
    ],
    shaft: { x: 200, y: 1000, w: 300, h: 800, angle: -18, color: "#F2F9FF", alpha: 0.12 },
  },
  duskCity: {
    pools: [
      // The low sun's warm spill over the skyline.
      { x: 800, y: 1160, r: 420, color: "#FFC77D", alpha: 0.3, breath: 0.6, phase: 0.9 },
      // Neon sign buzz, left side, deterministic dip.
      { x: 220, y: 1320, r: 280, color: "#C9B4FF", alpha: 0.2, breath: 1.1, phase: 2.6, flicker: 0.45 },
    ],
  },
  park: {
    pools: [
      // Morning sun warmth pooling on the path.
      { x: 560, y: 1400, r: 420, color: "#FFE9B0", alpha: 0.26, breath: 0.55, phase: 1.6 },
      // Sun's own glow, upper right (below the caption band edge).
      { x: 880, y: 950, r: 320, color: "#FFDD8A", alpha: 0.2, breath: 0.7, phase: 0.2 },
    ],
    shaft: { x: 820, y: 900, w: 260, h: 820, angle: -26, color: "#FFF6D8", alpha: 0.13 },
  },
  dreamNight: {
    pools: [
      // Moonbeam landing low-left, cream.
      { x: 300, y: 1360, r: 360, color: "#FFF4D8", alpha: 0.24, breath: 0.45, phase: 2.8 },
      // Violet dream-glow low-right.
      { x: 800, y: 1420, r: 340, color: "#B9A4F4", alpha: 0.18, breath: 0.65, phase: 1.1 },
    ],
    shaft: { x: 480, y: 0, w: 200, h: 940, angle: 8, color: "#F4F0FF", alpha: 0.1 },
  },
};

/** Palette the Background painter uses. Everything stays probe-safe. */export type EnvPalette = {
  /** Full-frame wall/sky gradient, top -> bottom. Light in the caption zone. */
  sky: readonly [string, string, string];
  /** Far-branch silhouettes / hills. */
  far: string;
  /** Mid-ground furniture / buildings. */
  mid: string;
  midLine: string;
  /** Floor band fill + top edge line. */
  floor: string;
  floorLine: string;
  /** Stage glow colour behind the character. */
  stageGlow: string;
  /** Small accent used by env details. */
  accent: string;
  /** Soft secondary accent. */
  accent2: string;
};

export const ENV_PALETTES: Record<EnvId, EnvPalette> = {
  study: {
    sky: ["#FFF8EE", "#FBEFDC", "#F6E4C8"],
    far: "#EAD9BC",
    mid: "#D9C3A0",
    midLine: "#B99B6F",
    floor: "#F0DFC2",
    floorLine: "#C9AD83",
    stageGlow: "rgba(255, 244, 224, 0.85)",
    accent: "#D97706",
    accent2: "#8FA3B8",
  },
  office: {
    sky: ["#F6FAFE", "#EAF2F9", "#DDE9F4"],
    far: "#C7D8E8",
    mid: "#AFC4D8",
    midLine: "#8FA9C2",
    floor: "#E8EFF6",
    floorLine: "#B9CBDD",
    stageGlow: "rgba(248, 251, 255, 0.85)",
    accent: "#2563EB",
    accent2: "#D97706",
  },
  duskCity: {
    sky: ["#FFF0DD", "#FBDDE2", "#E8D3EC"],
    far: "#C9C3E2",
    mid: "#9C9CC7",
    midLine: "#7D7DAE",
    floor: "#EFDCC8",
    floorLine: "#C4A48D",
    stageGlow: "rgba(255, 240, 220, 0.9)",
    accent: "#D97706",
    accent2: "#7C6BC4",
  },
  park: {
    sky: ["#F0FAFF", "#E7F6EC", "#F3FBE9"],
    far: "#BFE3C0",
    mid: "#95CFA0",
    midLine: "#6FAF7E",
    floor: "#DFF0D3",
    floorLine: "#A9D3A0",
    stageGlow: "rgba(250, 255, 244, 0.85)",
    accent: "#15803D",
    accent2: "#D97706",
  },
  dreamNight: {
    sky: ["#F2F3FC", "#E6E9F8", "#D9DFF4"],
    far: "#C5CBE8",
    mid: "#A8B2D8",
    midLine: "#8792BE",
    floor: "#E4E8F7",
    floorLine: "#B4BDDF",
    stageGlow: "rgba(250, 250, 255, 0.9)",
    accent: "#7C3AED",
    accent2: "#D97706",
  },
};
