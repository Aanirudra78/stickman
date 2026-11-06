import rawScript from "../../public/script.json";
import type { VideoScript } from "../config";
import { parseScript } from "./parseScript";

/**
 * The video's single source of truth.
 * Edit `public/script.json`, not this file.
 */
export const SCRIPT: VideoScript = parseScript(rawScript);
