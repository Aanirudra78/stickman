/**
 * Phase 3/5A: AI-illustrated background plates.
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
  // Original five (Phase 3).
  study: "env/plates/study.jpg",
  office: "env/plates/office.jpg",
  duskCity: "env/plates/dusk-city.jpg",
  park: "env/plates/park.jpg",
  dreamNight: "env/plates/dream-night.jpg",

  // Phase 5A batch 1.
  neonStreet: "env/plates/neon-street.jpg",
  rooftopDawn: "env/plates/rooftop-dawn.jpg",
  library: "env/plates/library.jpg",
  rainWindow: "env/plates/rain-window.jpg",
  cafe: "env/plates/cafe.jpg",
  riverbank: "env/plates/riverbank.jpg",

  // Phase 5A batch 2.
  skylineNight: "env/plates/skyline-night.jpg",
  metroPlatform: "env/plates/metro-platform.jpg",
  officeNight: "env/plates/office-night.jpg",
  forestPath: "env/plates/forest-path.jpg",
  hilltopDawn: "env/plates/hilltop-dawn.jpg",
  gardenBench: "env/plates/garden-bench.jpg",
  starlitField: "env/plates/starlit-field.jpg",
  classroom: "env/plates/classroom.jpg",
  bedroomDesk: "env/plates/bedroom-desk.jpg",
  kitchenTable: "env/plates/kitchen-table.jpg",
  workshop: "env/plates/workshop.jpg",
};

export const hasPlate = (env: EnvId): boolean => Boolean(ENV_PLATES[env]);
