import { describe, expect, it } from "vitest";
import type { Action } from "../storyboard/storyboard-schema";
import { frameCountFor, scheduleActions } from "./action-schedule";

const composer = "[data-testid=ai-chat-input]";
const send = "[data-testid=ai-chat-send]";

describe("frameCountFor", () => {
  it("rounds duration times fps", () => {
    expect(frameCountFor(6, 30)).toBe(180);
    expect(frameCountFor(8, 60)).toBe(480);
  });
});

describe("scheduleActions", () => {
  const actions: Action[] = [
    { kind: "move", at: 0.8, target: composer },
    { kind: "click", at: 1, target: composer },
    { kind: "type", at: 1.2, target: composer, text: "Hi there" },
    { kind: "click", at: 4, target: send },
    { kind: "press", at: 5, key: "Escape" },
  ];
  const schedule = scheduleActions({ actions, duration: 6, fps: 30 });

  it("arrives at each target on the action's frame, starting no earlier than the previous action", () => {
    expect(schedule.travels).toEqual([
      { actionIndex: 0, target: composer, startFrame: 3, endFrame: 24 },
      { actionIndex: 1, target: composer, startFrame: 24, endFrame: 30 },
      { actionIndex: 3, target: send, startFrame: 99, endFrame: 120 },
    ]);
  });

  it("presses for a tenth of a second on a click", () => {
    expect(schedule.inputs[30]).toEqual([{ kind: "down", actionIndex: 1 }]);
    expect(schedule.inputs[33]).toEqual([{ kind: "up", actionIndex: 1 }]);
    expect(schedule.pressed.slice(29, 34)).toEqual([false, true, true, true, false]);
  });

  it("focuses the target, then types characters on their own frames", () => {
    expect(schedule.inputs[36][0]).toEqual({ kind: "focus", actionIndex: 2, target: composer });
    const typed = schedule.inputs.flatMap((frame) => frame.filter((input) => input.kind === "text"));
    expect(typed.map((input) => (input.kind === "text" ? input.text : "")).join("")).toBe("Hi there");
    expect(typed.length).toBe(8);
  });

  it("groups characters that land on the same frame", () => {
    const fast = scheduleActions({
      actions: [{ kind: "type", at: 0, target: composer, text: "abcd" }],
      duration: 1,
      fps: 10,
    });
    const texts = fast.inputs.flatMap((frame) =>
      frame.flatMap((input) => (input.kind === "text" ? [input.text] : []))
    );
    expect(texts.join("")).toBe("abcd");
    expect(texts.length).toBeLessThan(4);
  });

  it("keeps a late action on the last frame", () => {
    const late = scheduleActions({ actions: [{ kind: "press", at: 6, key: "Enter" }], duration: 6, fps: 30 });
    expect(late.inputs[179]).toEqual([{ kind: "key", actionIndex: 0, key: "Enter" }]);
  });

  it("orders actions by time, keeping their original index", () => {
    const reordered = scheduleActions({
      actions: [
        { kind: "click", at: 2, target: send },
        { kind: "move", at: 1, target: composer },
      ],
      duration: 3,
      fps: 30,
    });
    expect(reordered.travels.map((travel) => travel.actionIndex)).toEqual([1, 0]);
  });
});
