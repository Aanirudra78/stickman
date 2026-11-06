import React from "react";
import { Composition } from "remotion";
import { SCRIPT } from "./script/script";
import { StickmanVideo } from "./video/StickmanVideo";
import { FPS, HEIGHT, WIDTH } from "./config";
import { getTotalDurationInFrames } from "./timeline/timeline";
import { getSpeechEndSeconds } from "./voice/voiceover";

/**
 * Composition registration.
 * Keep metadata inline on <Composition> so Studio can edit it back to code.
 *
 * The length is derived from the script plus the generated narration, so
 * adding a scene or editing its `voiceover` (then re-running
 * `npm run voiceover`) changes the composition automatically.
 */

export const RemotionRoot: React.FC = () => {
  const speechEnds = SCRIPT.scenes.map((_, index) => getSpeechEndSeconds(index));
  const durationInFrames = getTotalDurationInFrames(SCRIPT.scenes, FPS, speechEnds);

  return (
    <>
      <Composition
        id="StickmanExplainer"
        component={StickmanVideo}
        durationInFrames={durationInFrames}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          script: SCRIPT,
        }}
      />
    </>
  );
};
