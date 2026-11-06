import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Fonts are self-hosted in `public/fonts` so rendering does not depend on the
 * network. `loadFont` blocks the render until the font is ready (delayRender),
 * which is required for Devanagari shaping to be correct on frame 0.
 *
 * Noto Sans Devanagari handles conjuncts (क्ष, भ्य, ...) and matras, so the
 * same setup keeps working if the script is switched back to Hindi/Hinglish.
 * Inter is the Latin companion and carries the current English script.
 */

export const DEVANAGARI_FAMILY = "Noto Sans Devanagari";
export const LATIN_FAMILY = "Inter";

const devanagari = loadFont({
  family: DEVANAGARI_FAMILY,
  url: staticFile("fonts/NotoSansDevanagari-Variable.ttf"),
  weight: "100 900",
});

const latin = loadFont({
  family: LATIN_FAMILY,
  url: staticFile("fonts/Inter-Variable.ttf"),
  weight: "100 900",
});

export const fontsReady: Promise<[void, void]> = Promise.all([
  devanagari,
  latin,
]);

/** Devanagari first, Latin as per-glyph fallback. */
export const TEXT_FONT_FAMILY = `"${DEVANAGARI_FAMILY}", "${LATIN_FAMILY}", sans-serif`;

/**
 * Guard against a silent font fallback (which would break Devanagari shaping).
 * Called during render, after `loadFont()` has resolved.
 */
export const assertFontsLoaded = (): void => {
  if (typeof document === "undefined") {
    return;
  }

  const missing = [DEVANAGARI_FAMILY, LATIN_FAMILY].filter(
    (family) => !document.fonts.check(`16px "${family}"`),
  );

  if (missing.length > 0) {
    throw new Error(
      `Font(s) not available: ${missing.join(", ")}. Rendering would fall back to a system font and break Devanagari shaping.`,
    );
  }
};
