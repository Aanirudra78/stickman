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
import { blendAction, getActiveAction, sampleAction } from "../actions/sample";
import type { ActionId } from "../actions/types";
import { COLORS, type Scene, type VideoScript } from "../config";
import { assertFontsLoaded, TEXT_FONT_FAMILY } from "../fonts";
import { mixPose, POSES, type FaceParams, type JointAngles } from "../poses/poses";
import type { PropId } from "../props/ids";
import {
  STICKMAN_HEIGHT,
  STICKMAN_HIP_X,
  STICKMAN_HIP_Y,
  STICKMAN_WIDTH,
  Stickman,
  type StickmanProp,
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
  type StageLayout,
} from "../timeline/timeline";
import {
  assertVoiceoverMatchesScript,
  getItemRevealSeconds,
  getSpeechEndSeconds,
  getVoiceScene,
  getWordStartSeconds,
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

/** Where the main character stands while a guest is on screen. */
const GUEST_STAGE: StageLayout = { x: 400, y: 1279, scale: 1.22 };
/** Where the guest stands (right side, slightly smaller). */
const GUEST_SPOT: StageLayout = { x: 844, y: 1279, scale: 1.12 };

/** Camera punch per action. The value is added to the push-in scale. */
const ACTION_CAMERA: Partial<Record<ActionId, number>> = {
  shock: 0.1,
  jump: 0.03,
  dash: 0.06,
  fall: 0.04,
  fight: 0.05,
  happy: 0.02,
  proud: 0.02,
};

type GuestState = {
  scene: Scene;
  /** Real seconds this scene lasts (stretched to the narration). */
  sceneSeconds: number;
  localSeconds: number;
  fps: number;
  frame: number;
};

/** The guest cameo figure + name tag. Rendered next to the main character. */
const GuestCameo: React.FC<GuestState> = ({
  scene,
  sceneSeconds,
  localSeconds,
  fps,
  frame,
}) => {
  const guest = scene.guest;
  const duration = sceneSeconds;

  if (!guest) return null;

  const at = guest.at ?? 0.25;
  const exit = Math.max(at + 0.8, guest.exit ?? duration - 0.35);
  if (localSeconds < at || localSeconds > exit + 0.4) return null;

  const enter = guest.enter ?? "walk";
  const entry = clamp01((localSeconds - at) / 0.45);
  const leave = clamp01((exit - localSeconds) / 0.35);
  const presence = Math.min(entry, leave);
  const eased = easeOutCubic(entry);

  let offsetX = 0;
  let offsetY = 0;
  let scaleMul = 1;
  let rot = 0;

  if (enter === "walk") {
    offsetX = 210 * (1 - eased);
    offsetY = -Math.abs(Math.sin(entry * Math.PI * 3)) * 14 * (1 - eased);
  } else if (enter === "jump") {
    offsetY = -Math.sin(entry * Math.PI) * 128;
    scaleMul = 1 + Math.sin(entry * Math.PI) * 0.04;
  } else {
    scaleMul = 0.2 + 0.8 * eased;
    rot = (1 - eased) * 24;
  }

  // Leaving: slide back out to the right and fade.
  offsetX += 150 * (1 - leave);
  offsetY -= 8 * (1 - leave);

  const poseName = guest.pose ?? "idle";
  const pose = POSES[poseName];
  const nod = Math.sin(localSeconds * Math.PI * 2 * 0.9) * 2.2;
  const baseAngles: JointAngles = {
    ...pose.angles,
    headTilt: pose.angles.headTilt + nod,
  };
  const baseFace: FaceParams = {
    ...pose.face,
    mouthSmile: Math.max(pose.face.mouthSmile, 0.55),
    gazeX: pose.face.gazeX - 2.1,
    browLift: pose.face.browLift + 0.15,
  };

  // Walk in, leap in, or appear out of thin air - then settle into idle.
  const entranceClip: ActionId =
    enter === "walk" ? "walk" : enter === "jump" ? "jump" : "spin";
  const entranceWeight =
    enter === "magic" ? clamp01(1 - entry) : enter === "jump" ? 0.9 : 0.85;
  const entranceSample = sampleAction(entranceClip, localSeconds);
  const guestActed = blendAction(
    baseAngles,
    baseFace,
    entranceSample,
    entranceWeight,
  );

  const scale = GUEST_SPOT.scale * scaleMul;

  const tagScale = 0.7 + 0.3 * eased;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STICKMAN_WIDTH,
          height: STICKMAN_HEIGHT,
          transformOrigin: `${STICKMAN_HIP_X}px ${STICKMAN_HIP_Y}px`,
          translate: `${
            GUEST_SPOT.x - STICKMAN_HIP_X + offsetX + 14
          }px ${GUEST_SPOT.y - STICKMAN_HIP_Y + offsetY}px`,
          scale: `${scale}`,
          rotate: `${rot.toFixed(2)}deg`,
          opacity: Math.min(1, presence * 2.2),
          filter: `drop-shadow(0px 16px 22px ${COLORS.characterShadow})`,
        }}
      >
        <Stickman
          angles={guestActed.angles}
          face={guestActed.face}
          blink={getEyeOpenness(frame + 23, fps)}
        />

        {/* Name tag: just the name, as requested. */}
        <div
          style={{
            position: "absolute",
            left: STICKMAN_HIP_X,
            top: STICKMAN_HIP_Y - 306,
            transform: `translate(-50%, -100%) scale(${tagScale.toFixed(3)})`,
            transformOrigin: "50% 100%",
            backgroundColor: COLORS.ink,
            color: "#FFFFFF",
            fontFamily: TEXT_FONT_FAMILY,
            fontWeight: 700,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: 0.3,
            padding: "12px 26px 14px",
            borderRadius: 999,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
          }}
        >
          {guest.name}
        </div>
      </div>

      {/* Magic entrance sparkles. */}
      {enter === "magic" && entry < 1
        ? [0, 1, 2, 3, 4, 5].map((index) => {
            const angle = (index / 6) * Math.PI * 2 + 0.4;
            const radius = 120 + entry * 120;
            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: GUEST_SPOT.x + Math.cos(angle) * radius,
                  top: GUEST_SPOT.y - 260 + Math.sin(angle) * radius * 0.6,
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  backgroundColor: COLORS.accent,
                  opacity: (1 - entry) * 0.8,
                }}
              />
            );
          })
        : null}
    </>
  );
};

/**
 * Timeline driver: owns every frame-dependent decision (which scene is
 * showing, which pose pair to blend, which action plays on top, where the
 * character stands, props, guests, blinking, the talking mouth) and renders
 * the narration, scene templates plus the figures on top.
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
  const localSeconds = Math.max(0, (frame - window.start) / fps);

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

  // ---- Action ----------------------------------------------------------
  // An action clip is layered over the pose: it owns the joints it animates
  // and leaves the rest of the body to the pose + micro-motion.
  // `word` is resolved against the real narration, so a beat starts on the
  // spoken verb instead of a seconds estimate.
  const scheduledActions = (scene.actions ?? []).map((entry) => {
    if (entry.word === undefined) return entry;
    const start = getWordStartSeconds(sceneIndex, entry.word);
    return start === undefined
      ? entry
      : { ...entry, at: Math.max(0, start - 0.02) };
  });
  const action = getActiveAction(scheduledActions, localSeconds);
  const actionWeight = action?.weight ?? 0;
  const sample = action ? sampleAction(action.id, action.elapsed) : null;
  const acted = sample
    ? blendAction(mixed.angles, mixed.face, sample, actionWeight)
    : { angles: mixed.angles, face: mixed.face };

  // ---- Speech ----------------------------------------------------------
  const voice = getVoiceScene(sceneIndex);
  const speaking = voice
    ? isWordActiveAt(sceneIndex, (frame - window.start) / fps)
    : isSpeaking(scene);

  // ---- Pose energy -----------------------------------------------------
  const head = solveSkeleton(acted.angles).head;
  const armRaise = Math.max(
    Math.abs(acted.angles.shoulderL),
    Math.abs(acted.angles.shoulderR),
  );
  const poseEnergy = Math.min(1, Math.max(0, (armRaise - 92) / 23));

  // ---- Acting beats ----------------------------------------------------
  const sway = getBodySway(frame, fps);
  const weight = getWeightShift(frame, fps);
  const lilt = getSpeechLilt(frame, fps);
  const follow = getPoseFollowThrough(activePose.framesSinceChange, fps, 1);
  const gestureWeight =
    (armRaise > 95 ? 0 : 1) * (1 - actionWeight * 0.75);
  const motionAngles: JointAngles = {
    ...acted.angles,
    spine: acted.angles.spine + sway * 0.6 + weight * 0.35,
    headTilt: acted.angles.headTilt - sway * 0.35 + (speaking ? lilt * 1.1 : 0),
    shoulderL:
      acted.angles.shoulderL -
      (speaking ? lilt * 0.8 : 0) * gestureWeight +
      follow * -3.2 * gestureWeight,
    shoulderR:
      acted.angles.shoulderR +
      (speaking ? lilt * 3.2 : sway * 0.7) * gestureWeight +
      follow * 6.2 * gestureWeight,
    elbowR:
      acted.angles.elbowR +
      (speaking ? lilt * 4.6 : sway * 1.0) * gestureWeight +
      follow * 7.5 * gestureWeight,
  };

  // ---- Guest -----------------------------------------------------------
  const guest = scene.guest;
  const guestWordStart =
    guest?.word !== undefined
      ? getWordStartSeconds(sceneIndex, guest.word)
      : undefined;
  const guestAt =
    guestWordStart !== undefined
      ? Math.max(0, guestWordStart - 0.06)
      : guest?.at ?? 0.25;
  const guestExit = guest
    ? Math.max(guestAt + 0.8, guest.exit ?? window.durationInFrames / fps - 0.4)
    : 0;
  const guestIn = guest ? clamp01((localSeconds - guestAt) / 0.3) : 0;
  const guestOut = guest ? clamp01((guestExit - localSeconds) / 0.3) : 0;
  const guestPresence = guest ? Math.min(guestIn, guestOut) : 0;
  const hasGuest = Boolean(guest) && guestPresence > 0.001;
  // The cameo draws its own entrance, so hand it the resolved start time.
  const guestScene: Scene = guest
    ? { ...scene, guest: { ...guest, at: guestAt } }
    : scene;

  // ---- Face ------------------------------------------------------------
  const saccade = getGazeSaccade(frame, fps);
  const placementBlend = getPlacementBlend(frame - window.start);
  const previousScene = script.scenes[Math.max(0, sceneIndex - 1)];
  const lookFrom = TEXT_LOOK[previousScene.scene_type];
  const lookTo = TEXT_LOOK[scene.scene_type];
  const lookX = lookFrom.x + (lookTo.x - lookFrom.x) * placementBlend;
  const lookY = lookFrom.y + (lookTo.y - lookFrom.y) * placementBlend;
  const browLift =
    acted.face.browLift +
    poseEnergy * 0.2 +
    (speaking ? Math.abs(lilt) * 0.12 : 0);
  const face: FaceParams = {
    ...acted.face,
    browLift,
    browTilt: acted.face.browTilt + (speaking ? lilt * 0.1 : 0),
    gazeX:
      acted.face.gazeX +
      saccade.x +
      lookX +
      (hasGuest ? 2.2 * guestPresence : 0),
    gazeY: acted.face.gazeY + saccade.y + lookY,
    mouthOpen: speaking ? getTalkingMouth(frame) : acted.face.mouthOpen,
  };
  const blink = getEyeOpenness(frame, fps);

  // ---- Placement -------------------------------------------------------
  const baseLayout = mixLayout(
    STAGE_LAYOUTS[previousScene.scene_type],
    STAGE_LAYOUTS[scene.scene_type],
    placementBlend,
  );
  const layout = hasGuest
    ? mixLayout(baseLayout, GUEST_STAGE, guestPresence)
    : baseLayout;
  const breath = getBreathOffset(frame, fps, mixed.bobAmplitude);

  // ---- Action root motion ---------------------------------------------
  const actionX = (sample?.x ?? 0) * actionWeight;
  const actionY = (sample?.y ?? 0) * actionWeight;
  const actionRot = (sample?.rot ?? 0) * actionWeight;
  const squash = 1 + ((sample?.squash ?? 1) - 1) * actionWeight;

  // ---- Camera ----------------------------------------------------------
  const sceneProgress = interpolate(
    frame - window.start,
    [0, Math.max(1, window.durationInFrames - 1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const punch = action ? (ACTION_CAMERA[action.id] ?? 0) * actionWeight : 0;
  const cameraScale =
    (1 + 0.06 * sceneProgress) *
    (1 + punch) *
    (1 - guestPresence * 0.02);

  // ---- Hook entrance ---------------------------------------------------
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

  // ---- Props -----------------------------------------------------------
  const propPop = spring({
    frame: Math.max(0, frame - window.start - 4),
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 160 },
    durationInFrames: 22,
  });
  const heldProps: PropId[] = [...(scene.props ?? [])];
  const actionProp =
    action && actionWeight > 0.25 ? sample?.prop ?? undefined : undefined;
  if (actionProp && !heldProps.includes(actionProp) && heldProps.length < 2) {
    heldProps.push(actionProp);
  }
  const stickmanProps: StickmanProp[] = heldProps.slice(0, 2).map((id, index) => ({
    id,
    hand: index === 0 ? "R" : "L",
    scale: 0.9,
    opacity: Math.min(1, propPop * 1.4),
  }));

  // Weight shift + breath also move the shadow so he stays planted.
  const shadowX = sway * 2.4 + weight * 2.2;
  const shadowY = 14 + poseEnergy * 8 + breath * 0.5;

  const FOOT_LOCAL_Y = 165;
  const hookFootAnchor =
    sceneIndex === 0 ? FOOT_LOCAL_Y * (layout.scale - characterScale) : 0;

  const characterTransform = {
    transformOrigin: `${STICKMAN_HIP_X}px ${STICKMAN_HIP_Y}px`,
    translate: `${
      layout.x - STICKMAN_HIP_X + sway * 3.5 + weight * 2.5 + actionX * characterScale
    }px ${
      layout.y -
      STICKMAN_HIP_Y +
      breath +
      hookFootAnchor +
      actionY * characterScale
    }px`,
    scale: `${(characterScale * (2 - squash)).toFixed(4)} ${(
      characterScale * squash
    ).toFixed(4)}`,
    rotate: `${(sway * 0.35 + weight * 0.4 + actionRot).toFixed(2)}deg`,
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

        {/* Guest cameo (under the main character so he never covers him). */}
        <GuestCameo
          scene={guestScene}
          sceneSeconds={window.durationInFrames / fps}
          localSeconds={localSeconds}
          fps={fps}
          frame={frame}
        />

        {/* Persistent main character */}
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
          <Stickman
            angles={motionAngles}
            face={face}
            blink={blink}
            props={stickmanProps}
            groundY={158 - actionY}
          />
        </div>
      </div>

      <Overlays title={script.title} windows={windows} />
    </AbsoluteFill>
  );
};
