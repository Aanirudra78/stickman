/** Every prop the renderer can draw in a hand. Shared by the action clips. */
export const PROP_IDS = [
  "money",
  "coin",
  "wallet",
  "phone",
  "laptop",
  "book",
  "tea",
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
  // rewards
  "trophy",
  "medal",
  "crown",
  "star",
  "diamond",
  "gift",
  "piggy_bank",
  // ideas / mind
  "brain",
  "heart",
  "target",
  "flag",
  "lightning",
  // plan / navigation
  "map",
  "compass",
  "key",
  "bell",
  "ladder",
  // life / tech
  "fire",
  "plant",
  "mic",
  "camera",
  "globe",
  "battery",
  "dice",
  "scale",
  "chain",
] as const;

export type PropId = (typeof PROP_IDS)[number];

export const isPropId = (value: unknown): value is PropId =>
  typeof value === "string" && (PROP_IDS as readonly string[]).includes(value);
