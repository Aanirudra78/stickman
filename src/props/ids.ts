/** Every prop the renderer can draw in a hand. Shared by the action clips. */
export const PROP_IDS = [
  "money",
  "coin",
  "wallet",
  "phone",
  "laptop",
  "chart_up",
  "chart_down",
  "clock",
  "calendar",
  "house",
  "car",
  "lock",
  "shield",
  "warning",
  "question",
  "bulb",
  "arrow",
  "check",
  "cross",
  "magnifier",
  "hammer",
  "food",
] as const;

export type PropId = (typeof PROP_IDS)[number];

export const isPropId = (value: unknown): value is PropId =>
  typeof value === "string" && (PROP_IDS as readonly string[]).includes(value);
