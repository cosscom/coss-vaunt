import type { Action } from "../storyboard/storyboard-schema";

/** How long the cursor takes to reach a target, cut short when the previous action is closer. */
export const CURSOR_TRAVEL_SECONDS = 0.7;
export const PRESS_SECONDS = 0.1;
export const TYPE_CHARACTERS_PER_SECOND = 20;

export type CursorTravel = { actionIndex: number; target: string; startFrame: number; endFrame: number };

export type FrameInput =
  | { kind: "down"; actionIndex: number }
  | { kind: "up"; actionIndex: number }
  | { kind: "focus"; actionIndex: number; target: string }
  | { kind: "text"; actionIndex: number; text: string }
  | { kind: "key"; actionIndex: number; key: string };

export type ActionSchedule = {
  frameCount: number;
  /** In time order; the cursor arrives at each target on the action's own frame. */
  travels: CursorTravel[];
  /** Inputs to send on each frame, in order. */
  inputs: FrameInput[][];
  /** Frames on which the pointer is held down. */
  pressed: boolean[];
};

export function frameCountFor(duration: number, fps: number): number {
  return Math.max(1, Math.round(duration * fps));
}

/** Turns a clip's timed actions into per-frame pointer travels and inputs. */
export function scheduleActions({
  actions,
  duration,
  fps,
}: {
  actions: readonly Action[];
  duration: number;
  fps: number;
}): ActionSchedule {
  const frameCount = frameCountFor(duration, fps);
  const frameOf = (seconds: number) => Math.min(frameCount - 1, Math.max(0, Math.round(seconds * fps)));
  const travelFrames = Math.round(CURSOR_TRAVEL_SECONDS * fps);
  const pressFrames = Math.max(1, Math.round(PRESS_SECONDS * fps));
  const inputs: FrameInput[][] = Array.from({ length: frameCount }, () => []);
  const pressed: boolean[] = Array.from({ length: frameCount }, () => false);
  const travels: CursorTravel[] = [];
  let pointerFreeFrame = 0;

  const ordered = actions
    .map((action, actionIndex) => ({ action, actionIndex }))
    .sort((a, b) => a.action.at - b.action.at);
  for (const { action, actionIndex } of ordered) {
    const frame = frameOf(action.at);
    switch (action.kind) {
      case "move":
      case "click": {
        const startFrame = Math.min(frame, Math.max(pointerFreeFrame, frame - travelFrames));
        travels.push({ actionIndex, target: action.target, startFrame, endFrame: frame });
        pointerFreeFrame = frame;
        if (action.kind === "move") break;
        const upFrame = Math.min(frameCount - 1, frame + pressFrames);
        inputs[frame].push({ kind: "down", actionIndex });
        inputs[upFrame].push({ kind: "up", actionIndex });
        for (let pressedFrame = frame; pressedFrame < upFrame; pressedFrame++) pressed[pressedFrame] = true;
        pointerFreeFrame = upFrame;
        break;
      }
      case "type": {
        inputs[frame].push({ kind: "focus", actionIndex, target: action.target });
        const characters = [...action.text];
        let index = 0;
        while (index < characters.length) {
          const charFrame = frameOf(action.at + index / TYPE_CHARACTERS_PER_SECOND);
          let text = "";
          while (
            index < characters.length &&
            frameOf(action.at + index / TYPE_CHARACTERS_PER_SECOND) === charFrame
          ) {
            text += characters[index];
            index++;
          }
          inputs[charFrame].push({ kind: "text", actionIndex, text });
        }
        break;
      }
      case "press":
        inputs[frame].push({ kind: "key", actionIndex, key: action.key });
        break;
    }
  }
  return { frameCount, travels, inputs, pressed };
}
