/**
 * Phase 3: AI-illustrated background plates.
 *
 * Each entry maps an environment to a full-frame illustrated plate
 * (1080x1920, flat pastel storybook style, no people/text) that
 * Background.tsx renders as the base layer instead of the painted
 * sky+SVG stack. The painted stack stays as the automatic fallback for
 * any environment missing here, and for the caption scrim + stage glow
 * we still lean on the palette in environments.ts.
 *
 * Plates live in public/env/plates/ and are committed assets; they are
 * probed by scripts/probe-plates.mjs (caption-band lightness contract).
 */
import type { EnvId } from "./environments";

export const ENV_PLATES: Partial<Record<EnvId, string>> = {
  study: "env/plates/study.jpg",
  office: "env/plates/office.jpg",
  duskCity: "env/plates/dusk-city.jpg",
  park: "env/plates/park.jpg",
  dreamNight: "env/plates/dream-night.jpg",
};

export const hasPlate = (env: EnvId): boolean => Boolean(ENV_PLATES[env]);
