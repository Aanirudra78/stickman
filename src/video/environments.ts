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

export type EnvId =
  | "study"
  | "office"
  | "duskCity"
  | "park"
  | "dreamNight"
  | "neonStreet"
  | "skylineNight"
  | "metroPlatform"
  | "officeNight"
  | "rooftopDawn"
  | "hilltopDawn"
  | "riverbank"
  | "forestPath"
  | "gardenBench"
  | "starlitField"
  | "library"
  | "cafe"
  | "rainWindow"
  | "classroom"
  | "bedroomDesk"
  | "kitchenTable"
  | "workshop";

export const ENV_IDS: readonly EnvId[] = [
  "study",
  "office",
  "duskCity",
  "park",
  "dreamNight",
  "neonStreet",
  "skylineNight",
  "metroPlatform",
  "officeNight",
  "rooftopDawn",
  "hilltopDawn",
  "riverbank",
  "forestPath",
  "gardenBench",
  "starlitField",
  "library",
  "cafe",
  "rainWindow",
  "classroom",
  "bedroomDesk",
  "kitchenTable",
  "workshop",
];

/**
 * Narrative arc: when a scene matches no keyword, its WORLD is chosen by where
 * it sits in the film, not by a blind cycle - quiet rooms for the opening,
 * busy worlds for the build, open air for the turn, warm light for the close.
 */
const ARC = {
  intro: ["study", "bedroomDesk", "cafe", "library"] as readonly EnvId[],
  build: [
    "office",
    "officeNight",
    "classroom",
    "workshop",
    "metroPlatform",
    "cafe",
  ] as readonly EnvId[],
  middle: [
    "duskCity",
    "neonStreet",
    "skylineNight",
    "riverbank",
    "forestPath",
    "park",
  ] as readonly EnvId[],
  resolve: [
    "rooftopDawn",
    "hilltopDawn",
    "gardenBench",
    "starlitField",
    "dreamNight",
    "study",
  ] as readonly EnvId[],
} as const;

const ENV_RULES: readonly (readonly [EnvId, readonly string[]])[] = [
  [
    "rainWindow",
    [
      "rain",
      "barish",
      "monsoon",
      "tear",
      "tears",
      "aansu",
      "sad",
      "lonely",
      "alone",
      "miss",
      "missing",
      "memory",
      "memories",
      "yaad",
      "window",
      "wait",
      "waiting",
      "silence",
      "silent",
    ],
  ],
  [
    "cafe",
    [
      "cafe",
      "coffee",
      "chai",
      "tea",
      "conversation",
      "talk",
      "meet",
      "meeting a friend",
      "friend",
      "friends",
      "date",
      "breakup",
      "gossip",
      "discuss",
      "discussion",
    ],
  ],
  [
    "library",
    [
      "library",
      "books",
      "book",
      "pages",
      "chapter",
      "chapters",
      "knowledge",
      "wisdom",
      "research",
      "syllabus",
      "quote",
      "quotes",
      "philosophy",
    ],
  ],
  [
    "classroom",
    [
      "class",
      "classroom",
      "teacher",
      "teachers",
      "lecture",
      "blackboard",
      "students",
      "student",
      "lesson",
      "lessons",
      "homework",
    ],
  ],
  [
    "workshop",
    [
      "workshop",
      "tools",
      "build",
      "building",
      "make",
      "making",
      "create",
      "creating",
      "craft",
      "repair",
      "fix",
      "fixing",
      "project",
      "habit",
      "habits",
      "skill",
      "skills",
      "practice",
      "practice",
      "hands",
    ],
  ],
  [
    "kitchenTable",
    [
      "kitchen",
      "cook",
      "cooking",
      "food",
      "khana",
      "dinner",
      "lunch",
      "breakfast",
      "ghar",
      "home",
      "family",
      "maa",
      "mummy",
      "mumma",
      "papa",
    ],
  ],
  [
    "bedroomDesk",
    [
      "bedroom",
      "bed",
      "awake",
      "lying",
      "scroll",
      "scrolling",
      "phone",
      "insomnia",
      "neend",
      "bedtime",
      "pyjama",
      "blanket",
    ],
  ],
  [
    "metroPlatform",
    [
      "metro",
      "train",
      "station",
      "platform",
      "commute",
      "travel",
      "travelling",
      "journey",
      "safar",
      "rasta",
      "bus",
      "ticket",
    ],
  ],
  [
    "officeNight",
    [
      "deadline",
      "deadlines",
      "overtime",
      "grind",
      "grinding",
      "struggle",
      "mehnat",
      "hard work",
      "late night",
      "burnout",
      "pressure",
      "target",
    ],
  ],
  [
    "skylineNight",
    [
      "skyline",
      "towers",
      "tower",
      "buildings",
      "city lights",
      "rooftop",
      "terrace",
      "skyline",
    ],
  ],
  [
    "neonStreet",
    [
      "neon",
      "party",
      "club",
      "bar",
      "music",
      "dance",
      "dancing",
      "weekend",
      "celebrate",
      "celebration",
      "enjoy",
      "masti",
    ],
  ],
  [
    "rooftopDawn",
    [
      "dawn",
      "sunrise",
      "new day",
      "fresh start",
      "beginning",
      "starter",
      "hope",
      "umeed",
      "tomorrow",
      "kal se",
    ],
  ],
  [
    "hilltopDawn",
    [
      "hill",
      "hills",
      "mountain",
      "mountains",
      "pahad",
      "climb",
      "climbing",
      "summit",
      "height",
      "win",
      "victory",
      "achieve",
      "achievement",
      "goal",
      "goals",
    ],
  ],
  [
    "riverbank",
    [
      "river",
      "nadi",
      "flow",
      "water",
      "kinara",
      "let go",
      "chhodo",
      "chhod",
      "calm",
      "stillness",
      "breathe",
    ],
  ],
  [
    "forestPath",
    [
      "forest",
      "jungle",
      "path",
      "trail",
      "lost",
      "explore",
      "adventure",
      "trees",
      "tree",
      "wander",
      "curious",
    ],
  ],
  [
    "gardenBench",
    [
      "garden",
      "flower",
      "flowers",
      "phool",
      "bloom",
      "blooming",
      "beauty",
      "bench",
      "relax",
      "sitting",
      "sit",
      "smell",
    ],
  ],
  [
    "starlitField",
    [
      "stars",
      "starlit",
      "universe",
      "infinite",
      "cosmic",
      "galaxy",
      "wish",
      "wishes",
      "imagine",
      "imagination",
      "someday",
      "dream big",
    ],
  ],
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
 * The environment for a scene. An explicit `scene.env` (from the studio UI)
 * always wins in the renderer; this is the automatic path.
 *
 * 1. Keyword match on the scene's own words (text + items), most specific
 *    worlds first.
 * 2. Otherwise the narrative arc: the band of the film decides the pool, the
 *    index picks inside it deterministically, and two equal worlds never sit
 *    next to each other.
 */
export const pickEnvironment = (
  text: string,
  items: readonly string[] | undefined,
  sceneIndex: number,
  previous?: EnvId,
  totalScenes?: number,
): EnvId => {
  const haystack = [text, ...(items ?? [])].join(" ").toLowerCase();
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

  const total = totalScenes && totalScenes > 0 ? totalScenes : 1;
  const role = total === 1 ? 0.5 : sceneIndex / (total - 1);
  const band =
    role < 0.18
      ? ARC.intro
      : role < 0.52
        ? ARC.build
        : role < 0.8
          ? ARC.middle
          : ARC.resolve;
  let at = sceneIndex % band.length;
  if (band[at] === previous) at = (at + 1) % band.length;
  return band[at];
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
  neonStreet: {
    pools: [
      // Neon sign buzz low-left, deterministic dip.
      { x: 250, y: 1300, r: 300, color: "#F472B6", alpha: 0.24, breath: 1.2, phase: 0.6, flicker: 0.4 },
      // Violet street glow low-right.
      { x: 800, y: 1380, r: 340, color: "#A78BFA", alpha: 0.18, breath: 0.8, phase: 2.2 },
    ],
  },
  skylineNight: {
    pools: [
      // Cool city haze over the skyline.
      { x: 560, y: 1180, r: 420, color: "#C7D2FE", alpha: 0.18, breath: 0.5, phase: 1.4 },
      // Warm window glow low-right.
      { x: 860, y: 1380, r: 260, color: "#FDE68A", alpha: 0.16, breath: 0.9, phase: 3.1 },
    ],
  },
  metroPlatform: {
    pools: [
      // Cool overhead fluorescent pool.
      { x: 540, y: 1300, r: 440, color: "#E0F2FE", alpha: 0.22, breath: 0.6, phase: 0.8 },
      // Warm signal-orange on the left.
      { x: 200, y: 1420, r: 240, color: "#FDBA74", alpha: 0.16, breath: 0.9, phase: 2.6 },
    ],
  },
  officeNight: {
    pools: [
      // Monitor glow low-left, faint flicker like a CRT.
      { x: 300, y: 1320, r: 300, color: "#BFDBFE", alpha: 0.2, breath: 0.7, phase: 1.1, flicker: 0.12 },
      // Desk lamp warm pool low-right.
      { x: 800, y: 1360, r: 280, color: "#FDE68A", alpha: 0.18, breath: 0.8, phase: 3.3 },
    ],
  },
  rooftopDawn: {
    pools: [
      // Sunrise spill on the terrace.
      { x: 560, y: 1400, r: 440, color: "#FDBA74", alpha: 0.26, breath: 0.5, phase: 0.4 },
      // Pale sky glow upper-right, below the caption band.
      { x: 880, y: 980, r: 300, color: "#FEF3C7", alpha: 0.16, breath: 0.6, phase: 2.0 },
    ],
    shaft: { x: 820, y: 940, w: 240, h: 760, angle: -22, color: "#FFF7E0", alpha: 0.12 },
  },
  hilltopDawn: {
    pools: [
      // Golden light on the summit.
      { x: 540, y: 1380, r: 460, color: "#FCD34D", alpha: 0.24, breath: 0.45, phase: 1.3 },
      // Warm haze low-left.
      { x: 240, y: 1280, r: 300, color: "#FDBA74", alpha: 0.15, breath: 0.6, phase: 2.9 },
    ],
    shaft: { x: 480, y: 860, w: 280, h: 820, angle: 16, color: "#FFF3D0", alpha: 0.13 },
  },
  riverbank: {
    pools: [
      // Water shimmer low-centre.
      { x: 560, y: 1340, r: 420, color: "#BAE6FD", alpha: 0.2, breath: 0.5, phase: 0.6 },
      // Warm sun on the bank.
      { x: 840, y: 1400, r: 300, color: "#FEF08A", alpha: 0.16, breath: 0.7, phase: 2.4 },
    ],
    shaft: { x: 780, y: 900, w: 240, h: 780, angle: -18, color: "#FFF8DC", alpha: 0.11 },
  },
  forestPath: {
    pools: [
      // Dappled morning light on the path.
      { x: 520, y: 1360, r: 400, color: "#D9F99D", alpha: 0.2, breath: 0.6, phase: 1.7 },
      // Cool green depth on the right.
      { x: 860, y: 1240, r: 320, color: "#BBF7D0", alpha: 0.14, breath: 0.8, phase: 3.0 },
    ],
    shaft: { x: 540, y: 880, w: 220, h: 800, angle: 12, color: "#F6FFE8", alpha: 0.12 },
  },
  gardenBench: {
    pools: [
      // Blossom-warm light on the bench.
      { x: 620, y: 1380, r: 380, color: "#FBCFE8", alpha: 0.2, breath: 0.55, phase: 0.9 },
      // Soft green shade left.
      { x: 240, y: 1300, r: 300, color: "#D9F99D", alpha: 0.13, breath: 0.7, phase: 2.7 },
    ],
    shaft: { x: 760, y: 920, w: 220, h: 740, angle: -14, color: "#FFF6EE", alpha: 0.11 },
  },
  starlitField: {
    pools: [
      // Moonlight on the meadow.
      { x: 340, y: 1360, r: 380, color: "#E0E7FF", alpha: 0.2, breath: 0.45, phase: 2.2 },
      // Violet star shimmer low-right.
      { x: 800, y: 1420, r: 320, color: "#C4B5FD", alpha: 0.16, breath: 0.7, phase: 0.5 },
    ],
    shaft: { x: 460, y: 860, w: 200, h: 820, angle: 6, color: "#F5F3FF", alpha: 0.1 },
  },
  library: {
    pools: [
      // Reading-lamp pool over the desk.
      { x: 320, y: 1320, r: 320, color: "#FDE68A", alpha: 0.26, breath: 0.7, phase: 0.3 },
      // Warm shelf wash right.
      { x: 840, y: 1260, r: 340, color: "#F5E0C3", alpha: 0.16, breath: 0.5, phase: 2.5 },
    ],
    shaft: { x: 200, y: 960, w: 240, h: 760, angle: 22, color: "#FFF4DC", alpha: 0.12 },
  },
  cafe: {
    pools: [
      // Pendant lamp over the table.
      { x: 480, y: 1240, r: 320, color: "#FCD9A8", alpha: 0.24, breath: 0.8, phase: 1.5 },
      // Warm counter glow right.
      { x: 860, y: 1340, r: 300, color: "#FDBA74", alpha: 0.16, breath: 0.6, phase: 3.2 },
    ],
    shaft: { x: 720, y: 940, w: 200, h: 700, angle: -10, color: "#FFF1DC", alpha: 0.1 },
  },
  rainWindow: {
    pools: [
      // Cool window light spilling in.
      { x: 540, y: 1200, r: 420, color: "#BAE6FD", alpha: 0.18, breath: 0.5, phase: 0.7 },
      // Warm lamp pool low-left.
      { x: 260, y: 1440, r: 260, color: "#FDE68A", alpha: 0.15, breath: 0.8, phase: 2.1 },
    ],
    shaft: { x: 420, y: 900, w: 260, h: 780, angle: 4, color: "#EFF8FF", alpha: 0.1 },
  },
  classroom: {
    pools: [
      // Daylight wash over the desks.
      { x: 560, y: 1340, r: 440, color: "#ECFCCB", alpha: 0.2, breath: 0.5, phase: 1.0 },
      // Warm teacher's-desk lamp.
      { x: 860, y: 1400, r: 260, color: "#FDE68A", alpha: 0.15, breath: 0.7, phase: 2.8 },
    ],
    shaft: { x: 220, y: 940, w: 300, h: 780, angle: -16, color: "#F7FFE8", alpha: 0.12 },
  },
  bedroomDesk: {
    pools: [
      // Warm desk lamp by the bed.
      { x: 320, y: 1360, r: 300, color: "#FCD9A8", alpha: 0.24, breath: 0.6, phase: 1.8 },
      // Cool moonlight through the window.
      { x: 840, y: 1240, r: 320, color: "#DBEAFE", alpha: 0.15, breath: 0.45, phase: 0.2 },
    ],
    shaft: { x: 760, y: 900, w: 220, h: 760, angle: -8, color: "#F2F6FF", alpha: 0.1 },
  },
  kitchenTable: {
    pools: [
      // Morning light through the kitchen window.
      { x: 560, y: 1360, r: 400, color: "#FDE68A", alpha: 0.22, breath: 0.5, phase: 0.5 },
      // Warm stove glow left.
      { x: 240, y: 1400, r: 260, color: "#FDBA74", alpha: 0.15, breath: 0.7, phase: 2.3 },
    ],
    shaft: { x: 600, y: 900, w: 280, h: 780, angle: 14, color: "#FFF6E4", alpha: 0.12 },
  },
  workshop: {
    pools: [
      // Hanging work lamp pool.
      { x: 480, y: 1260, r: 340, color: "#FDE68A", alpha: 0.26, breath: 0.9, phase: 1.2, flicker: 0.08 },
      // Cool bench light right.
      { x: 840, y: 1400, r: 280, color: "#E2E8F0", alpha: 0.14, breath: 0.6, phase: 3.0 },
    ],
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
  neonStreet: {
    sky: ["#FBF3FF", "#F3E8FE", "#EADCFB"],
    far: "#D8C9EC",
    mid: "#B9A4D8",
    midLine: "#9B84C0",
    floor: "#F1E4F2",
    floorLine: "#D0B8D8",
    stageGlow: "rgba(252, 244, 255, 0.9)",
    accent: "#7C3AED",
    accent2: "#F472B6",
  },
  skylineNight: {
    sky: ["#F4F2FF", "#EBE9FE", "#DEDCFA"],
    far: "#C7C4EA",
    mid: "#A9A5D6",
    midLine: "#8B87BE",
    floor: "#E8E5F6",
    floorLine: "#B9B4DA",
    stageGlow: "rgba(248, 246, 255, 0.9)",
    accent: "#6366F1",
    accent2: "#F59E0B",
  },
  metroPlatform: {
    sky: ["#F4F8FC", "#EAF1F8", "#DEE8F2"],
    far: "#C3D3E4",
    mid: "#A6BAD0",
    midLine: "#879CB6",
    floor: "#E7EEF5",
    floorLine: "#B7C7D8",
    stageGlow: "rgba(248, 251, 255, 0.9)",
    accent: "#0EA5E9",
    accent2: "#F97316",
  },
  officeNight: {
    sky: ["#F5F7FC", "#EBF0F9", "#DDE6F4"],
    far: "#C2D0E6",
    mid: "#A3B6D4",
    midLine: "#8496B8",
    floor: "#E6EDF6",
    floorLine: "#B4C3DA",
    stageGlow: "rgba(247, 250, 255, 0.9)",
    accent: "#2563EB",
    accent2: "#F59E0B",
  },
  rooftopDawn: {
    sky: ["#FFF8F0", "#FDEEDD", "#FBE2CB"],
    far: "#F0CFB6",
    mid: "#E0B194",
    midLine: "#C39176",
    floor: "#F6E4D0",
    floorLine: "#D5B69A",
    stageGlow: "rgba(255, 248, 240, 0.9)",
    accent: "#EA580C",
    accent2: "#0EA5E9",
  },
  hilltopDawn: {
    sky: ["#FFF9F0", "#FDF0DC", "#FBE5C8"],
    far: "#E8D3AE",
    mid: "#CFB98F",
    midLine: "#AE9A72",
    floor: "#F2E5CB",
    floorLine: "#CDB896",
    stageGlow: "rgba(255, 250, 240, 0.9)",
    accent: "#D97706",
    accent2: "#15803D",
  },
  riverbank: {
    sky: ["#F3FBF5", "#EAF7EC", "#DFF2E3"],
    far: "#BCE0C4",
    mid: "#95CBA4",
    midLine: "#74AE84",
    floor: "#E3F2DC",
    floorLine: "#AFD2A4",
    stageGlow: "rgba(248, 255, 248, 0.9)",
    accent: "#15803D",
    accent2: "#0EA5E9",
  },
  forestPath: {
    sky: ["#F2FAF1", "#EAF6E8", "#DEF0DC"],
    far: "#B7DDBA",
    mid: "#8FC796",
    midLine: "#6BA576",
    floor: "#DEEDD6",
    floorLine: "#A9C99E",
    stageGlow: "rgba(247, 255, 244, 0.9)",
    accent: "#16A34A",
    accent2: "#D97706",
  },
  gardenBench: {
    sky: ["#FFF6F8", "#FDECF1", "#FBE2EA"],
    far: "#F0C8D5",
    mid: "#DFA9BC",
    midLine: "#C2859B",
    floor: "#F6E3E8",
    floorLine: "#D6B4BF",
    stageGlow: "rgba(255, 248, 250, 0.9)",
    accent: "#DB2777",
    accent2: "#15803D",
  },
  starlitField: {
    sky: ["#F6F5FE", "#EEEDFB", "#E2E2F8"],
    far: "#C9C8EC",
    mid: "#ABA9DB",
    midLine: "#8C8AC0",
    floor: "#E9E7F6",
    floorLine: "#BAB6DC",
    stageGlow: "rgba(250, 249, 255, 0.9)",
    accent: "#7C3AED",
    accent2: "#0EA5E9",
  },
  library: {
    sky: ["#FFF9F0", "#FCF0DE", "#F7E6CC"],
    far: "#EBD5B5",
    mid: "#D8BC94",
    midLine: "#B79870",
    floor: "#F2E3CB",
    floorLine: "#CDB293",
    stageGlow: "rgba(255, 250, 242, 0.9)",
    accent: "#B45309",
    accent2: "#0EA5E9",
  },
  cafe: {
    sky: ["#FFF8F1", "#FCEEDF", "#F8E3CD"],
    far: "#EFD1B4",
    mid: "#DDB28F",
    midLine: "#BF9270",
    floor: "#F3E0CC",
    floorLine: "#D0B096",
    stageGlow: "rgba(255, 249, 242, 0.9)",
    accent: "#C2410C",
    accent2: "#15803D",
  },
  rainWindow: {
    sky: ["#F2F7FA", "#E9F1F6", "#DDE9F1"],
    far: "#BCD2DF",
    mid: "#9AB7C8",
    midLine: "#7A98AB",
    floor: "#E4EEF4",
    floorLine: "#B2C7D5",
    stageGlow: "rgba(247, 251, 254, 0.9)",
    accent: "#0369A1",
    accent2: "#D97706",
  },
  classroom: {
    sky: ["#F9FAF4", "#F3F6E8", "#EBF0DC"],
    far: "#D3DCC0",
    mid: "#B7C49D",
    midLine: "#96A47B",
    floor: "#EEF1E0",
    floorLine: "#C3CBA8",
    stageGlow: "rgba(251, 253, 246, 0.9)",
    accent: "#65A30D",
    accent2: "#D97706",
  },
  bedroomDesk: {
    sky: ["#F5F6FC", "#EDEFF9", "#E2E6F5"],
    far: "#C8CFE8",
    mid: "#A9B3D6",
    midLine: "#8A96BE",
    floor: "#E8ECF7",
    floorLine: "#B6C0DD",
    stageGlow: "rgba(249, 250, 255, 0.9)",
    accent: "#4F46E5",
    accent2: "#F59E0B",
  },
  kitchenTable: {
    sky: ["#FFF8F0", "#FDF0E1", "#FAE6CF"],
    far: "#EFD3B4",
    mid: "#DEB590",
    midLine: "#C1946F",
    floor: "#F4E2CB",
    floorLine: "#D2B296",
    stageGlow: "rgba(255, 250, 243, 0.9)",
    accent: "#C2410C",
    accent2: "#15803D",
  },
  workshop: {
    sky: ["#FBFAF7", "#F6F3EC", "#EFEADD"],
    far: "#DDD5C3",
    mid: "#C4B9A2",
    midLine: "#A3977D",
    floor: "#F1ECDE",
    floorLine: "#CCC2AB",
    stageGlow: "rgba(252, 251, 248, 0.9)",
    accent: "#B45309",
    accent2: "#0F766E",
  },
};
