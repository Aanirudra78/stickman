import React from "react";
import { Audio, staticFile, useVideoConfig } from "remotion";
import type { SceneWindow } from "../timeline/timeline";

/**
 * Warm music bed under the narration. It ducks during every scene window
 * (computed right here from the timeline, no plan file) and swells back up
 * in the gaps, so the voice always wins.
 *
 * The bed is a real CC0 recording since Phase 2: a 55s excerpt of
 * "Calm Piano 1 (Vaporware)" (opengameart.org, CC0), normalized to sit under
 * the voice. Synthesized pad backup lives in out/cc0/bed-synth-backup.mp3.
 * The `loop` prop only matters for scripts longer than the excerpt.
 */

/** Fade in/out around each scene window, in seconds. */
const RAMP_SECONDS = 0.28;
/** Volume inside a scene window (0..1 of the bed's own level). */
const DUCK_LEVEL = 0.22;

const clip01 = (value: number) => Math.min(1, Math.max(0, value));

export const MusicBed: React.FC<{ windows: readonly SceneWindow[] }> = ({
  windows,
}) => {
  const { fps } = useVideoConfig();

  // Piecewise envelope per scene window: duck while the scene is on screen,
  // stay at full level in the transitions before/after.
  const levelAt = (seconds: number): number => {
    let level = 1;
    for (const window of windows) {
      const start = window.start / fps;
      const end = window.end / fps;
      const amount = Math.min(
        clip01((seconds - (start - RAMP_SECONDS)) / RAMP_SECONDS),
        clip01((end + RAMP_SECONDS - seconds) / RAMP_SECONDS),
      );
      if (amount === 0) {
        continue;
      }
      level = Math.min(level, 1 - (1 - DUCK_LEVEL) * amount);
    }
    return level;
  };

  return (
    <Audio
      name="Music bed"
      loop
      src={staticFile("music/bed.mp3")}
      volume={(frame) => levelAt(frame / fps)}
    />
  );
};
