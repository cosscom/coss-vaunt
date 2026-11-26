import { describe, expect, it } from "vitest";
import { createProject, createRecordingClip } from "../storyboard/storyboard-factories";
import type { Clip, Project } from "../storyboard/storyboard-schema";
import { canonicalJson, captureHashForClip, captureSpecFor, fnv1a64 } from "./capture-hash";

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

/** FNV-1a 64 with BigInt, as the hash was first written: recordings on disk are named by its output. */
function referenceFnv1a64(text: string): string {
  let hash = BigInt("0xcbf29ce484222325");
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * BigInt("0x100000001b3")) & BigInt("0xffffffffffffffff");
  }
  return hash.toString(16).padStart(16, "0");
}

describe("fnv1a64", () => {
  it("matches the published test vectors", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
  });

  it("hashes exactly as the BigInt version did, so existing takes still match", () => {
    const samples = [
      "héllo wörld ✓ 🎬",
      canonicalJson(captureSpecFor({ project, clip })),
      "x".repeat(10_000),
    ];
    let seed = 7;
    for (let index = 0; index < 500; index++) {
      seed = (seed * 48271) % 2147483647;
      samples.push(
        Array.from({ length: seed % 80 }, (_, char) =>
          String.fromCodePoint(((seed >> (char % 16)) % 0x2fff) + 32)
        ).join("")
      );
    }
    for (const sample of samples) expect(fnv1a64(sample)).toBe(referenceFnv1a64(sample));
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
