import { describe, expect, it } from "vitest";
import { createProject, createRecordingClip } from "../storyboard/storyboard-factories";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { canonicalJson, captureHashForClip, captureSpecFor } from "./capture-hash";

const project: Project = {
  ...createProject({ name: "Demo", now: new Date("2026-11-18T08:00:00Z") }),
  id: "demo",
};
const clip: Clip = {
  ...createRecordingClip({ name: "Ask", route: "/home", duration: 6 }),
  id: "clip-1",
  source: {
    kind: "recording",
    route: "/home",
    actions: [
      { kind: "click", at: 1, target: "[data-testid=ai-chat-input]" },
      { kind: "type", at: 1.2, target: "[data-testid=ai-chat-input]", text: "Book Sandy" },
    ],
  },
};
const hash = (
  overrides: Partial<Clip> = {},
  settings: Partial<Project["settings"]> = {},
  theme?: "light" | "dark"
) =>
  captureHashForClip({
    project: { settings: { ...project.settings, ...settings } },
    clip: { ...clip, ...overrides },
    theme,
  });

describe("canonicalJson", () => {
  it("ignores key order and undefined fields", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: undefined }] })).toBe(canonicalJson({ a: [{ d: 2 }], b: 1 }));
  });
});

describe("captureHashForClip", () => {
  it("is a stable 16-character hex string", () => {
    expect(hash()).toMatch(/^[0-9a-f]{16}$/);
    expect(hash()).toBe(hash());
  });

  it("ignores camera, placement, name and timeline edits", () => {
    const camera: Clip["properties"] = {
      rotateY: { value: 0, keyframes: [{ id: "k", at: 2, value: 25, ease: "ease-in-out" }] },
      panX: { value: 0.2, keyframes: [] },
      blur: { value: 0.5, keyframes: [] },
      fov: { value: 50, keyframes: [] },
      opacity: { value: 0.5, keyframes: [] },
      zoom: { value: 1.1, keyframes: [] },
    };
    expect(hash({ properties: camera, name: "Renamed", start: 12, transitionIn: "cross-blur" })).toBe(hash());
  });

  it("ignores the background and device look", () => {
    expect(
      hash(
        {},
        {
          background: { kind: "gradient", value: "linear-gradient(red, blue)" },
          device: { ...project.settings.device, plinth: true },
        }
      )
    ).toBe(hash());
  });

  it("changes with anything that changes the pixels", () => {
    const base = hash();
    const changed = [
      hash({ duration: 7 }),
      hash({ source: { kind: "recording", route: "/home", actions: [] } }),
      hash({ focus: "[data-testid=ai-chat-send]" }),
      hash({}, { fps: 30 }),
      hash({}, {}, "dark"),
      hash({ properties: { zoom: { value: 3, keyframes: [] } } }),
      hash({}, { aspectRatio: "9:16" }),
    ];
    for (const other of changed) expect(other).not.toBe(base);
    expect(new Set(changed).size).toBe(changed.length);
  });

  it("uses the project theme unless one is given", () => {
    expect(hash({}, { theme: "dark" })).toBe(hash({}, {}, "dark"));
  });

  it("refuses routes that aren't app paths and non-recording clips", () => {
    expect(() =>
      captureSpecFor({
        project,
        clip: { ...clip, source: { kind: "recording", route: "//elsewhere.example", actions: [] } },
      })
    ).toThrow("//elsewhere.example");
    expect(() =>
      captureSpecFor({
        project,
        clip: { ...clip, source: { kind: "text", text: "Hi", size: "title", align: "center", weight: 600 } },
      })
    ).toThrow("not a recording");
  });
});
