import type { PropertyKey } from "../../storyboard/property-specs";
import type { CubicPoints } from "../../storyboard/storyboard-schema";

/** Values added to the clip's own pose, except these, which scale it; so a preset layers on any pose. */
export const SCALED_KEYS: ReadonlySet<PropertyKey> = new Set(["opacity", "scale", "zoom"]);

export type MotionPose = Partial<Record<PropertyKey, number>>;

export type MotionPreset = {
  id: string;
  name: string;
  description: string;
  group: "device" | "camera";
  /** Length of the entrance, and of the exit; shortened on short clips. */
  seconds: number;
  /** Where the entrance starts from, relative to the clip's pose. */
  enter: MotionPose;
  /** Where the exit ends; the entrance's start pose when omitted. */
  exit?: MotionPose;
  /** The entrance's curve; the exit plays it mirrored. */
  ease: CubicPoints;
};

const OUT_EXPO: CubicPoints = [0.16, 1, 0.3, 1];
const OUT_QUINT: CubicPoints = [0.22, 1, 0.36, 1];
const OUT_BACK: CubicPoints = [0.34, 1.56, 0.64, 1];
const IN_OUT_CUBIC: CubicPoints = [0.65, 0, 0.35, 1];

export const MOTION_PRESETS: readonly MotionPreset[] = [
  {
    id: "fade",
    name: "Fade",
    description: "Fades in and out in place",
    group: "device",
    seconds: 0.5,
    enter: { opacity: 0 },
    ease: OUT_QUINT,
  },
  {
    id: "rise",
    name: "Rise",
    description: "Rises into place, tipped back, and sinks away",
    group: "device",
    seconds: 0.9,
    enter: { y: 0.12, rotateX: 18, opacity: 0 },
    ease: OUT_EXPO,
  },
  {
    id: "flip-up",
    name: "Flip up",
    description: "Hinges up from lying flat",
    group: "device",
    seconds: 1,
    enter: { rotateX: 80, opacity: 0 },
    ease: OUT_QUINT,
  },
  {
    id: "swing",
    name: "Swing",
    description: "Swings in from the left like a door and out to the right",
    group: "device",
    seconds: 1,
    enter: { rotateY: -55, x: -0.15, opacity: 0 },
    exit: { rotateY: 55, x: 0.15, opacity: 0 },
    ease: OUT_QUINT,
  },
  {
    id: "tilt-reveal",
    name: "Tilt reveal",
    description: "Settles from a tilted, smaller pose",
    group: "device",
    seconds: 1.1,
    enter: { rotateX: 32, rotateZ: -6, scale: 0.85, opacity: 0 },
    ease: OUT_EXPO,
  },
  {
    id: "spin",
    name: "Spin",
    description: "Spins up from small with a little overshoot",
    group: "device",
    seconds: 0.9,
    enter: { rotateZ: -25, scale: 0.6, opacity: 0 },
    ease: OUT_BACK,
  },
  {
    id: "pop",
    name: "Pop",
    description: "Pops in with a springy overshoot",
    group: "device",
    seconds: 0.6,
    enter: { scale: 0.7, opacity: 0 },
    ease: OUT_BACK,
  },
  {
    id: "zoom-through",
    name: "Fly by",
    description: "Arrives from in front of the camera and leaves through it",
    group: "device",
    seconds: 0.8,
    enter: { scale: 1.5, opacity: 0 },
    ease: OUT_EXPO,
  },
  {
    id: "slide",
    name: "Slide",
    description: "Slides in from the right and out to the left",
    group: "device",
    seconds: 0.8,
    enter: { x: 1 },
    exit: { x: -1 },
    ease: OUT_EXPO,
  },
  {
    id: "peek",
    name: "Peek",
    description: "Turns to face the viewer, then turns away",
    group: "device",
    seconds: 1.2,
    enter: { rotateY: 35, rotateX: 10 },
    exit: { rotateY: -35, rotateX: 10 },
    ease: IN_OUT_CUBIC,
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "The camera circles round to face the device",
    group: "camera",
    seconds: 1.4,
    enter: { cameraY: -40 },
    exit: { cameraY: 40 },
    ease: IN_OUT_CUBIC,
  },
  {
    id: "dolly",
    name: "Dolly",
    description: "The camera pushes in, and pulls back out",
    group: "camera",
    seconds: 1.4,
    enter: { zoom: 0.75 },
    ease: OUT_QUINT,
  },
  {
    id: "crane",
    name: "Crane",
    description: "The camera rises from below to eye level",
    group: "camera",
    seconds: 1.4,
    enter: { cameraX: -30 },
    exit: { cameraX: 30 },
    ease: IN_OUT_CUBIC,
  },
];

export function findMotionPreset(id: string): MotionPreset | null {
  return MOTION_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The same curve played backwards, for the exit. */
export function mirrorCubic([x1, y1, x2, y2]: CubicPoints): CubicPoints {
  return [1 - x2, 1 - y2, 1 - x1, 1 - y1];
}

/** A pose's value for `key` given the clip's own value there. */
export function poseValue(key: PropertyKey, offset: number, rest: number): number {
  return SCALED_KEYS.has(key) ? rest * offset : rest + offset;
}
