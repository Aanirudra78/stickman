import React, { useMemo } from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { PropId } from "../props/ids";
import type { Scene, VideoScript } from "../config";
import type { SceneWindow } from "../timeline/timeline";

/**
 * Scene-driven sound effects. Since Phase 2 the clips are REAL CC0 recordings
 * from kenney.nl (Interface Sounds / Casino Audio / Impact Sounds packs) plus
 * the original synthesized whoosh - all royalty-free by construction. See
 * LICENSES.md.
 *
 *   whoosh - a scene change (skipped on the very first scene)
 *   pop    - a prop appears in the character's hand
 *   coin   - the prop is money or a coin (payouts, savings)
 *   tick   - the prop is a clock/calendar (or a warning feels ticking)
 *   ding   - a guest walks in
 *   thud   - a jump lands
 *
 * Triggers are rate limited so audio never turns into a popcorn machine:
 * at most one effect per MIN_GAP_SECONDS, and when effects collide the
 * most informative one wins (ding over coin/tick/thud over pop over whoosh).
 */

const MIN_GAP_SECONDS = 1.2;

type SfxKind = "whoosh" | "pop" | "coin" | "tick" | "ding" | "thud";

const KINDS: Record<
  SfxKind,
  { file: string; volume: number; priority: number; length: number }
> = {
  // Volumes tuned against the measured mix (voice RMS ~ -19 dBFS, ducked bed
  // ~ -40): each effect lands a few dB under the voice yet clearly audible.
  // Since Phase 2 every clip is a real CC0 recording (kenney.nl), loudness
  // measured per file so the volume lands the cue at its target level.
  whoosh: { file: "sfx/whoosh.wav", volume: 2.1, priority: 1, length: 0.5 }, // ~ -27 dBFS
  pop: { file: "sfx/pop.wav", volume: 1.0, priority: 2, length: 0.3 }, // ~ -21 dBFS
  coin: { file: "sfx/coin.wav", volume: 2.2, priority: 3, length: 0.4 }, // ~ -22 dBFS
  tick: { file: "sfx/tick.wav", volume: 0.9, priority: 3, length: 0.2 }, // ~ -22 dBFS
  ding: { file: "sfx/ding.wav", volume: 0.45, priority: 4, length: 0.5 }, // ~ -19 dBFS
  thud: { file: "sfx/thud.wav", volume: 0.9, priority: 3, length: 0.6 }, // ~ -18 dBFS
};

const MONEY_PROPS: readonly PropId[] = ["money", "coin"];
const TIME_PROPS: readonly PropId[] = ["clock", "calendar"];
const WARNING_PROPS: readonly PropId[] = ["warning"];

/** Which sound a prop deserves, if any. */
const kindForProp = (prop: PropId): SfxKind | undefined => {
  if (MONEY_PROPS.includes(prop)) return "coin";
  if (TIME_PROPS.includes(prop)) return "tick";
  if (WARNING_PROPS.includes(prop)) return "tick";
  return "pop";
};

type Trigger = { kind: SfxKind; seconds: number };

const triggersForScenes = (
  scenes: readonly Scene[],
  windows: readonly SceneWindow[],
  fps: number,
): Trigger[] => {
  const triggers: Trigger[] = [];

  scenes.forEach((scene, index) => {
    const window = windows[index];
    if (!window) {
      return;
    }
    const startSeconds = window.start / fps;

    // Scene change: airy transition. The opening already fades in from black.
    if (index > 0 && startSeconds > 0.5) {
      triggers.push({ kind: "whoosh", seconds: startSeconds + 0.02 });
    }

    // Props spring into the hands a few frames after the window starts.
    (scene.props ?? []).forEach((prop, propIndex) => {
      const kind = kindForProp(prop);
      if (!kind) {
        return;
      }
      triggers.push({
        kind,
        seconds: startSeconds + 0.18 + propIndex * 0.28,
      });
    });

    // Guest arrival gets its own arrival chime (highest priority, so a
    // simultaneous prop pop never swallows it).
    if (scene.guest) {
      triggers.push({
        kind: "ding",
        seconds: startSeconds + (scene.guest.at ?? 0.25),
      });
    }

    // Jump landing thud: the landing key sits ~0.78s into the jump clip
    // (same constant the DustPuffs use).
    const jump = (scene.actions ?? []).find((entry) => entry.id === "jump");
    if (jump) {
      triggers.push({ kind: "thud", seconds: startSeconds + jump.at + 0.78 });
    }
  });

  return triggers;
};

/** Drops any trigger that lands too soon after an already-accepted one. */
const rateLimit = (triggers: readonly Trigger[]): Trigger[] => {
  const accepted: Trigger[] = [];
  const priority = (kind: SfxKind) => KINDS[kind].priority;

  // Highest-priority sounds claim their spot first; generic whooshes fill in.
  const ordered = [...triggers].sort(
    (a, b) => priority(b.kind) - priority(a.kind) || a.seconds - b.seconds,
  );
  for (const trigger of ordered) {
    const clash = accepted.some(
      (other) => Math.abs(other.seconds - trigger.seconds) < MIN_GAP_SECONDS,
    );
    if (!clash) {
      accepted.push(trigger);
    }
  }
  return accepted.sort((a, b) => a.seconds - b.seconds);
};

export const SceneSfx: React.FC<{
  script: VideoScript;
  windows: readonly SceneWindow[];
}> = ({ script, windows }) => {
  const { fps } = useVideoConfig();

  const triggers = useMemo(
    () => rateLimit(triggersForScenes(script.scenes, windows, fps)),
    [script.scenes, windows, fps],
  );

  return (
    <>
      {triggers.map((trigger, index) => {
        const spec = KINDS[trigger.kind];
        return (
          <Sequence
            key={`${trigger.kind}-${index}`}
            name={`SFX ${trigger.kind} ${Math.round(trigger.seconds * 100) / 100}s`}
            from={Math.max(0, Math.round(trigger.seconds * fps))}
            durationInFrames={Math.ceil(spec.length * fps)}
            layout="none"
          >
            <Audio
              name={`SFX ${trigger.kind}`}
              src={staticFile(spec.file)}
              volume={spec.volume}
            />
          </Sequence>
        );
      })}
    </>
  );
};
