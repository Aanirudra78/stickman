import { ACTION_IDS, isActionId } from "../actions/types";
import { POSE_NAMES, type PoseName } from "../poses/poses";
import { isPropId, PROP_IDS } from "../props/ids";
import type {
  GuestEntrance,
  PoseChange,
  Scene,
  SceneAction,
  SceneGuest,
  SceneType,
  VideoScript,
} from "../config";

/**
 * Validates the JSON script and turns it into a typed `VideoScript`.
 * Fails loudly with the exact path of the broken field so editing the JSON
 * never silently produces a broken video.
 */

const SCENE_TYPES: SceneType[] = ["text", "points"];

const parseWordIndex = (value: unknown, path: string): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(path, "must be a non-negative integer word index");
  }
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Declared as a function so TypeScript treats it as never-returning and
// narrows the surrounding values after the call.
function fail(path: string, message: string): never {
  throw new Error(`script.json -> ${path}: ${message}`);
}

const parsePose = (value: unknown, path: string): PoseName => {
  if (typeof value !== "string" || !POSE_NAMES.includes(value as PoseName)) {
    fail(
      path,
      `must be one of ${POSE_NAMES.join(" | ")}, got ${JSON.stringify(value)}`,
    );
  }
  return value as PoseName;
};

const parseStringArray = (value: unknown, path: string): string[] => {
  if (!Array.isArray(value)) {
    fail(path, "must be an array of strings");
  }
  const entries = value as unknown[];
  if (entries.some((entry) => typeof entry !== "string")) {
    fail(path, "must be an array of strings");
  }
  return entries as string[];
};

const parsePoseChanges = (value: unknown, path: string): PoseChange[] => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail(path, "must be an array of { at, pose }");
  }
  const entries = value as unknown[];

  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      fail(`${path}[${index}]`, "must be an object { at, pose }");
    }
    const at = entry.at;
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) {
      fail(`${path}[${index}].at`, "must be a non-negative number of seconds");
    }
    return { at, pose: parsePose(entry.pose, `${path}[${index}].pose`) };
  });
};

const parseActions = (value: unknown, path: string): SceneAction[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    fail(path, "must be an array of { at, id }");
  }
  const entries = value as unknown[];

  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      fail(`${path}[${index}]`, "must be an object { at, id }");
    }
    const at = entry.at;
    if (typeof at !== "number" || !Number.isFinite(at) || at < 0) {
      fail(`${path}[${index}].at`, "must be a non-negative number of seconds");
    }
    if (!isActionId(entry.id)) {
      fail(
        `${path}[${index}].id`,
        `must be one of ${ACTION_IDS.join(" | ")}, got ${JSON.stringify(entry.id)}`,
      );
    }
    return {
      at,
      id: entry.id,
      word: parseWordIndex(entry.word, `${path}[${index}].word`),
    };
  });
};

const parseProps = (value: unknown, path: string): Scene["props"] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    fail(path, "must be an array of prop ids");
  }
  const entries = value as unknown[];
  return entries.map((entry, index) => {
    if (!isPropId(entry)) {
      fail(
        `${path}[${index}]`,
        `must be one of ${PROP_IDS.join(" | ")}, got ${JSON.stringify(entry)}`,
      );
    }
    return entry;
  });
};

const GUEST_ENTRANCES: GuestEntrance[] = ["walk", "jump", "magic"];

const parseGuest = (value: unknown, path: string): SceneGuest | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    fail(path, "must be an object { name, at?, exit?, enter?, pose? }");
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    fail(`${path}.name`, "must be a non-empty string");
  }

  const numberField = (field: "at" | "exit") => {
    const raw = value[field];
    if (raw === undefined) return undefined;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      fail(`${path}.${field}`, "must be a non-negative number of seconds");
    }
    return raw;
  };

  if (value.enter !== undefined && !GUEST_ENTRANCES.includes(value.enter as GuestEntrance)) {
    fail(`${path}.enter`, `must be one of ${GUEST_ENTRANCES.join(" | ")}`);
  }

  return {
    name: value.name,
    at: numberField("at"),
    word: parseWordIndex(value.word, `${path}.word`),
    exit: numberField("exit"),
    enter: value.enter as GuestEntrance | undefined,
    pose:
      value.pose === undefined
        ? undefined
        : parsePose(value.pose, `${path}.pose`),
  };
};

const parseScene = (raw: unknown, index: number): Scene => {
  const path = `scenes[${index}]`;
  if (!isRecord(raw)) {
    fail(path, "must be an object");
  }

  if (typeof raw.text !== "string" || raw.text.trim().length === 0) {
    fail(`${path}.text`, "must be a non-empty string");
  }

  const sceneType = raw.scene_type;
  if (typeof sceneType !== "string" || !SCENE_TYPES.includes(sceneType as SceneType)) {
    fail(`${path}.scene_type`, `must be "text" or "points"`);
  }

  const duration = raw.duration;
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    fail(`${path}.duration`, "must be a positive number of seconds");
  }

  const pose = parsePose(raw.pose, `${path}.pose`);

  let items: string[] | undefined;
  if (raw.items !== undefined) {
    items = parseStringArray(raw.items, `${path}.items`);
  }

  if (sceneType === "points" && (!items || items.length === 0)) {
    fail(`${path}.items`, 'is required for scene_type "points"');
  }

  if (raw.speaking !== undefined && typeof raw.speaking !== "boolean") {
    fail(`${path}.speaking`, "must be a boolean");
  }

  if (raw.voiceover !== undefined) {
    if (typeof raw.voiceover !== "string" || raw.voiceover.trim().length === 0) {
      fail(`${path}.voiceover`, "must be a non-empty string");
    }
  }

  return {
    text: raw.text,
    pose,
    scene_type: sceneType as SceneType,
    duration,
    items,
    speaking: raw.speaking as boolean | undefined,
    pose_changes: parsePoseChanges(raw.pose_changes, `${path}.pose_changes`),
    actions: parseActions(raw.actions, `${path}.actions`),
    props: parseProps(raw.props, `${path}.props`),
    guest: parseGuest(raw.guest, `${path}.guest`),
    voiceover: raw.voiceover as string | undefined,
  };
};

export const parseScript = (raw: unknown): VideoScript => {
  if (!isRecord(raw)) {
    fail("root", "must be an object");
  }
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    fail("scenes", "must be a non-empty array");
  }
  if (raw.title !== undefined && typeof raw.title !== "string") {
    fail("title", "must be a string");
  }
  if (raw.voice !== undefined && typeof raw.voice !== "string") {
    fail("voice", "must be an Edge TTS voice name, e.g. \"en-IN-NeerjaNeural\"");
  }

  return {
    title: raw.title as string | undefined,
    voice: raw.voice as string | undefined,
    scenes: raw.scenes.map(parseScene),
  };
};

/** `speaking` defaults to true for the talking pose. */
export const isSpeaking = (scene: Scene): boolean =>
  scene.speaking ?? scene.pose === "talking";
