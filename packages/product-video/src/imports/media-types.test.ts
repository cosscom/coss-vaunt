import { describe, expect, it } from "vitest";
import { ACCEPTED_MEDIA, extensionOf, mediaTypeOf } from "./media-types";

describe("mediaTypeOf", () => {
  it.each([
    ["clip.MP4", "video/mp4", { kind: "video", extension: ".mp4" }],
    ["clip.mov", "video/quicktime", { kind: "video", extension: ".mov" }],
    ["clip.webm", "", { kind: "video", extension: ".webm" }],
    ["shot.jpeg", "image/jpeg", { kind: "image", extension: ".jpg" }],
    ["shot.gif", "application/octet-stream", { kind: "image", extension: ".gif" }],
    ["image", "image/png", { kind: "image", extension: ".png" }],
  ])("accepts %s as %s", (name, mime, type) => {
    expect(mediaTypeOf(name, mime)).toEqual(type);
  });

  it.each([
    ["logo.svg", "image/svg+xml"],
    ["logo.png", "image/svg+xml"],
    ["clip.mp4", "image/png"],
    ["notes.txt", "text/plain"],
    ["clip.avi", ""],
  ])("rejects %s (%s)", (name, mime) => {
    expect(mediaTypeOf(name, mime)).toBeNull();
  });
});

describe("extensionOf", () => {
  it("reads the last extension of the base name, lower-cased", () => {
    expect(extensionOf("a/b.c/Shot.PNG")).toBe(".png");
    expect(extensionOf(".hidden")).toBe("");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("ACCEPTED_MEDIA", () => {
  it("lists extensions and MIME types, without SVG", () => {
    expect(ACCEPTED_MEDIA.split(",")).toEqual(
      expect.arrayContaining([".mov", "video/quicktime", "image/png"])
    );
    expect(ACCEPTED_MEDIA).not.toContain("svg");
  });
});
