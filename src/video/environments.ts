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
