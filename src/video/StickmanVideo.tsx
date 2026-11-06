import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  getBodySway,
  getBreathOffset,
  getEyeOpenness,
  getGazeSaccade,
  getPlacementBlend,
  getPoseBlend,
  getPoseFollowThrough,
  getSpeechLilt,
  getTalkingMouth,
  getWeightShift,
  TEXT_LOOK,
} from "../animation/motion";
import { COLORS, type VideoScript } from "../config";
import { assertFontsLoaded } from "../fonts";
import { mixPose, POSES } from "../poses/poses";
import {
  STICKMAN_HEIGHT,
  STICKMAN_HIP_X,
  STICKMAN_HIP_Y,
  STICKMAN_WIDTH,
  Stickman,
} from "../rig/Stickman";
import { solveSkeleton } from "../rig/skeleton";
import { isSpeaking } from "../script/parseScript";
import { PointsScene } from "../scenes/PointsScene";
import type { SceneTransitionVariant } from "../scenes/SceneFrame";
import { TextScene } from "../scenes/TextScene";
import {
  buildPoseKeyframes,
  getActivePose,
  getSceneIndexAtFrame,
  getSceneWindows,
  mixLayout,
  STAGE_LAYOUTS,
} from "../timeline/timeline";
import {
  assertVoiceoverMatchesScript,
  getItemRevealSeconds,
  getSpeechEndSeconds,
  getVoiceScene,
  isWordActiveAt,
} from "../voice/voiceover";
import { Background } from "./Background";
import { Overlays } from "./Overlays";
import { PoseFx } from "./PoseFx";

/** Scene windows, stretched to fit the narration. */
export const useSceneWindows = (script: VideoScript) => {
  const { fps } = useVideoConfig();

  return useMemo(() => {
    const speechEnds = script.scenes.map((_, index) => getSpeechEndSeconds(index));
    const itemReveals = script.scenes.map((scene, index) =>
      scene.scene_type === "points"
        ? getItemRevealSeconds(index, scene.items ?? [])
        : [],
    );
    return {
      windows: getSceneWindows(script.scenes, fps, speechEnds),
      itemReveals,
      poseKeyframes: buildPoseKeyframes(
        script.scenes,
        fps,
        speechEnds,
        itemReveals,
      ),
    };
  }, [script.scenes, fps]);
};

/**
 * Timeline driver: owns every frame-dependent decision (which scene is
 * showing, which pose pair to blend, where the character stands, blinking,
 * the talking mouth, the acting beats) and renders the narration, scene
 * templates plus one persistent stickman on top.
 */
export const StickmanVideo: React.FC<{ script: VideoScript }> = ({ script }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  assertFontsLoaded();
  assertVoiceoverMatchesScript(script.scenes);

  const { windows, itemReveals, poseKeyframes } = useSceneWindows(script);

  const sceneIndex = getSceneIndexAtFrame(windows, frame);
  const scene = script.scenes[sceneIndex];
  const window = windows[sceneIndex];

  // ---- Pose ------------------------------------------------------------
  const activePose = getActivePose(poseKeyframes, frame);
  const poseBlend = getPoseBlend(
    activePose.framesSinceChange,
    activePose.to,
    fps,
  );
  const mixed = mixPose(
    POSES[activePose.from],
    POSES[activePose.to],
    poseBlend,
  );

  // ---- Speech ----------------------------------------------------------
  // The mouth flaps only while a word is actually being spoken, so the little
  // pauses in the narration close it. Scenes without narration fall back to
  // the script's `speaking` flag.
  const voice = getVoiceScene(sceneIndex);
  const speaking = voice
    ? isWordActiveAt(sceneIndex, (frame - window.start) / fps)
    : isSpeaking(scene);

  // ---- Pose energy -----------------------------------------------------
  // How open the silhouette is: drives the head burst and the shadow.
  const head = solveSkeleton(mixed.angles).head;
  const armRaise = Math.max(
    Math.abs(mixed.angles.shoulderL),
    Math.abs(mixed.angles.shoulderR),
  );
  // Arms below the shoulder never spark; the V poses ramp to a full burst.
  const poseEnergy = Math.min(1, Math.max(0, (armRaise - 92) / 23));

  // ---- Acting beats ----------------------------------------------------
  // Layer micro-motion on top of the blended pose: a slow weight shift, a
  // head/arm lilt on spoken words, and limb follow-through after each pose
  // change. All frame-pure.
  const sway = getBodySway(frame, fps);
  const weight = getWeightShift(frame, fps);
  const lilt = getSpeechLilt(frame, fps);
  const follow = getPoseFollowThrough(activePose.framesSinceChange, fps, 1);
  // Arms raised in a V (surprised/happy) must not wobble like a talking arm.
  const gestureWeight = armRaise > 95 ? 0 : 1;
  const motionAngles = {
    ...mixed.angles,
    spine: mixed.angles.spine + sway * 0.6 + weight * 0.35,
    headTilt: mixed.angles.headTilt - sway * 0.35 + (speaking ? lilt * 1.1 : 0),
    shoulderL:
      mixed.angles.shoulderL -
      (speaking ? lilt * 0.8 : 0) * gestureWeight +
      follow * -3.2 * gestureWeight,
    shoulderR:
      mixed.angles.shoulderR +
      (speaking ? lilt * 3.2 : sway * 0.7) * gestureWeight +
      follow * 6.2 * gestureWeight,
    elbowR:
      mixed.angles.elbowR +
      (speaking ? lilt * 4.6 : sway * 1.0) * gestureWeight +
      follow * 7.5 * gestureWeight,
  };

  // ---- Face ------------------------------------------------------------
  const saccade = getGazeSaccade(frame, fps);
  // Eyes drift toward the text column; the target differs by scene type and
  // eases across the cut with the rest of the placement.
  const placementBlend = getPlacementBlend(frame - window.start);
  const previousScene = script.scenes[Math.max(0, sceneIndex - 1)];
  const lookFrom = TEXT_LOOK[previousScene.scene_type];
  const lookTo = TEXT_LOOK[scene.scene_type];
  const lookX = lookFrom.x + (lookTo.x - lookFrom.x) * placementBlend;
  const lookY = lookFrom.y + (lookTo.y - lookFrom.y) * placementBlend;
  // Brows ride the voice and the pose energy.
  const browLift =
    mixed.face.browLift +
    poseEnergy * 0.2 +
    (speaking ? Math.abs(lilt) * 0.12 : 0);
  const face = {
    ...mixed.face,
    browLift,
    browTilt: mixed.face.browTilt + (speaking ? lilt * 0.1 : 0),
    gazeX: mixed.face.gazeX + saccade.x + lookX,
    gazeY: mixed.face.gazeY + saccade.y + lookY,
    mouthOpen: speaking ? getTalkingMouth(frame) : mixed.face.mouthOpen,
  };
  const blink = getEyeOpenness(frame, fps);

  // ---- Placement -------------------------------------------------------
  const layout = mixLayout(
    STAGE_LAYOUTS[previousScene.scene_type],
    STAGE_LAYOUTS[scene.scene_type],
    placementBlend,
  );
  const breath = getBreathOffset(frame, fps, mixed.bobAmplitude);

  // ---- Camera ----------------------------------------------------------
  // One slow push-in per scene (1.0 -> 1.06). The cut resets it, but the
  // scene transition masks the reset.
  const sceneProgress = interpolate(
    frame - window.start,
    [0, Math.max(1, window.durationInFrames - 1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const cameraScale = 1 + 0.06 * sceneProgress;

  // ---- Hook entrance ---------------------------------------------------
  // Scene 1 opens with a spring pop instead of simply appearing.
  const hookPop =
    sceneIndex === 0
      ? spring({
          frame,
          fps,
          config: { damping: 12, mass: 0.6, stiffness: 120 },
          durationInFrames: 28,
        })
      : 1;
  const characterScale = layout.scale * (0.3 + 0.7 * hookPop);
  const characterOpacity =
    sceneIndex === 0
      ? interpolate(frame, [0, 4], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  // Weight shift + breath also move the shadow so he stays planted.
  const shadowX = sway * 2.4 + weight * 2.2;
  const shadowY = 14 + poseEnergy * 8 + breath * 0.5;

  // The hook spring scales around the hip; nudge the translate so the soles
  // stay on the same floor line while he grows in, instead of floating up.
  const FOOT_LOCAL_Y = 165;
  const hookFootAnchor =
    sceneIndex === 0 ? FOOT_LOCAL_Y * (layout.scale - characterScale) : 0;

  const characterTransform = {
    transformOrigin: `${STICKMAN_HIP_X}px ${STICKMAN_HIP_Y}px`,
    translate: `${layout.x - STICKMAN_HIP_X + sway * 3.5 + weight * 2.5}px ${
      layout.y - STICKMAN_HIP_Y + breath + hookFootAnchor
    }px`,
    scale: `${characterScale}`,
    rotate: `${sway * 0.35 + weight * 0.4}deg`,
  } as const;

  // Mixed cuts: each scene gets a different transition flavour.
  const SCENE_TRANSITIONS: readonly SceneTransitionVariant[] = [
    "zoom",
    "slide",
    "wipe",
    "rise",
  ];
  const sceneVariant = SCENE_TRANSITIONS[sceneIndex % SCENE_TRANSITIONS.length];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: "hidden" }}>
      <Background sceneIndex={sceneIndex} sceneStart={window.start} />

      {/* Camera stage: a single slow push-in wraps everything but the
          background and the fixed overlay furniture. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          scale: `${cameraScale}`,
          transformOrigin: "50% 52%",
        }}
      >
        {/* Warm halo behind the character, attached to his stage position. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STICKMAN_WIDTH,
          height: STICKMAN_HEIGHT,
          ...characterTransform,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: STICKMAN_HIP_X - 300,
            top: STICKMAN_HIP_Y - 450,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(217, 119, 6, 0.09) 0%, rgba(217, 119, 6, 0.04) 42%, rgba(217, 119, 6, 0) 70%)",
          }}
        />
      </div>

      {/* Accent burst behind the head on the excited poses. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STICKMAN_WIDTH,
          height: STICKMAN_HEIGHT,
          ...characterTransform,
        }}
      >
        <PoseFx
          x={STICKMAN_HIP_X + head.x}
          y={STICKMAN_HIP_Y + head.y}
          intensity={poseEnergy}
        />
      </div>

      {/* Scene content + narration */}
      {windows.map((sceneWindow, index) => {
        const sceneData = script.scenes[index];
        const voiceScene = getVoiceScene(index);

        return (
          <Sequence
            key={index}
            name={`Scene ${index + 1}`}
            from={sceneWindow.start}
            durationInFrames={sceneWindow.durationInFrames}
            layout="none"
          >
            {voiceScene ? (
              <Audio name={`Narration ${index + 1}`} src={staticFile(voiceScene.file)} />
            ) : null}

            {sceneData.scene_type === "text" ? (
              <TextScene
                text={sceneData.text}
                durationInFrames={sceneWindow.durationInFrames}
                variant={sceneVariant}
                reverse={index % 2 === 1}
              />
            ) : (
              <PointsScene
                text={sceneData.text}
                items={sceneData.items ?? []}
                revealTimes={itemReveals[index]}
                durationInFrames={sceneWindow.durationInFrames}
                variant={sceneVariant}
                reverse={index % 2 === 1}
              />
            )}
          </Sequence>
        );
      })}

      {/* Persistent character */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: STICKMAN_WIDTH,
            height: STICKMAN_HEIGHT,
            ...characterTransform,
            opacity: characterOpacity,
            filter: `drop-shadow(${shadowX.toFixed(2)}px ${shadowY.toFixed(
              2,
            )}px ${(26 + poseEnergy * 10).toFixed(1)}px ${
              COLORS.characterShadow
            })`,
          }}
        >
          <Stickman angles={motionAngles} face={face} blink={blink} />
        </div>
      </div>

      <Overlays title={script.title} windows={windows} />
    </AbsoluteFill>
  );
};
