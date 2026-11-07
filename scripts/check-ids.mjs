import fs from "node:fs";
import { ACTION_IDS, PROP_IDS } from "../shared/detect.mjs";

const types = fs.readFileSync("src/actions/types.ts", "utf8");
const block = types.slice(types.indexOf("export const ACTION_IDS"), types.indexOf("] as const;"));
const lib = [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

console.log("detect rules", ACTION_IDS.length, "library", lib.length);
const missing = ACTION_IDS.filter((id) => !lib.includes(id));
const props = fs.readFileSync("src/props/ids.ts", "utf8");
const propBlock = props.slice(props.indexOf("export const PROP_IDS"), props.indexOf("] as const;"));
const propLib = [...propBlock.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
const missingProps = PROP_IDS.filter((id) => !propLib.includes(id));

console.log("missing clips:", missing);
console.log("missing prop drawings:", missingProps);
if (missing.length > 0 || missingProps.length > 0) {
  console.error("FAIL: detection references ids the renderer cannot draw");
  process.exit(1);
}
console.log("ok   every detected action and prop has a drawing");
