import { createTextClip } from "@coss/vaunt-engine/storyboard/storyboard-factories";
import type { AudioClip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { describe, expect, it } from "vitest";
import { ASSET_DRAG_TYPE, hasAssetDrag, parseAssetDrag, serializeAssetDrag } from "./asset-drag";

const text = { ...createTextClip({ text: "Hello" }), storyboardNodeId: "node-1" };
const audio: AudioClip = {
  id: "song",
  name: "Song",
  file: "imports/song.mp3",
  kind: "music",
  start: 4,
  duration: 20,
  trimStart: 0,
  fileDuration: 30,
  volume: { value: 1, keyframes: [] },
  fadeIn: 0,
  fadeOut: 0,
};

describe("asset drags", () => {
  it("recognises its own drag type", () => {
    expect(hasAssetDrag({ types: ["Files"] })).toBe(false);
    expect(hasAssetDrag({ types: ["text/plain", ASSET_DRAG_TYPE] })).toBe(true);
  });

  it("drops a copy with a fresh id that no longer belongs to a storyboard node", () => {
    const dropped = parseAssetDrag(serializeAssetDrag({ kind: "video", clip: text }), "video", () => "new");
    expect(dropped).toEqual({ kind: "video", clip: { ...text, id: "new", storyboardNodeId: undefined } });
    expect(parseAssetDrag(serializeAssetDrag({ kind: "audio", clip: audio }), "audio", () => "a2")).toEqual({
      kind: "audio",
      clip: { ...audio, id: "a2" },
    });
  });

  it("ignores drops on the wrong kind of track and malformed data", () => {
    expect(parseAssetDrag(serializeAssetDrag({ kind: "audio", clip: audio }), "video")).toBeNull();
    expect(parseAssetDrag("{", "video")).toBeNull();
    expect(parseAssetDrag(JSON.stringify({ kind: "video", clip: { id: "x" } }), "video")).toBeNull();
  });
});
