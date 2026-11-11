/**
 * Character looks: hair, hats and glasses drawn on the head by `Stickman`.
 *
 * The main character stays clean (he is the brand), but every guest gets a
 * deterministic look derived from their name, so "Meera" always arrives with
 * the same bun and "Rahul" with the same cap - they read as different people
 * instead of clones of the hero.
 */

export type CharacterLook = {
  hair: "none" | "short" | "spiky" | "bun" | "curly";
  hat: "none" | "cap" | "turban";
  glasses: boolean;
};

const HAIRS: readonly CharacterLook["hair"][] = [
  "short",
  "spiky",
  "bun",
  "curly",
];

/** A tiny deterministic hash, stable across renders. */
const hashName = (name: string) => {
  let hash = 0;
  const source = String(name ?? "").toLowerCase();
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

/**
 * The look for a guest name. About one guest in three wears glasses, one in
 * five a hat; the rest just get hair. Same name -> same look, always.
 */
export const lookForName = (name: string): CharacterLook => {
  const hash = hashName(name);
  return {
    hair: HAIRS[hash % HAIRS.length],
    hat: hash % 5 === 0 ? "turban" : hash % 7 === 1 ? "cap" : "none",
    glasses: hash % 3 === 0,
  };
};
