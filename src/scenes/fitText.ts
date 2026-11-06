import { SAFE_X } from "../config";

/**
 * Auto-fit for headlines. Inter's average advance is ~0.55em for mixed
 * sentence case, so a conservative estimate keeps every line inside the safe
 * area without measuring the DOM (which would make the render non-pure).
 */
export const TEXT_COLUMN_WIDTH = 1080 - SAFE_X * 2;

export const fitFontSize = (
  text: string,
  options: {
    max: number;
    min: number;
    /** Average glyph width as a fraction of the font size. */
    charWidth?: number;
    width?: number;
  },
): number => {
  const { max, min, charWidth = 0.6, width = TEXT_COLUMN_WIDTH } = options;
  const longest = text
    .split("\n")
    .reduce((longestLine, line) => Math.max(longestLine, line.trim().length), 1);

  return Math.max(min, Math.min(max, Math.floor(width / (charWidth * longest))));
};
