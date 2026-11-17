import { describe, expect, it } from "vitest";
import {
  audioFilesFromDrop,
  type MediaTransfer,
  mediaFilesFromClipboard,
  mediaFilesFromDrop,
  pastedFileName,
} from "./clipboard-media";

const NOW = Date.UTC(2026, 10, 17, 16, 30, 55);
const file = (name: string, type: string) => new File(["x"], name, { type });
const item = (value: File) => ({ kind: "file", type: value.type, getAsFile: () => value });
const textItem = { kind: "string", type: "text/plain", getAsFile: () => null };

describe("mediaFilesFromClipboard", () => {
  it("names a pasted screenshot blob", () => {
    const transfer: MediaTransfer = { files: [], items: [textItem, item(file("image.png", "image/png"))] };
    const [pasted] = mediaFilesFromClipboard(transfer, NOW);
    expect(pasted?.name).toBe("pasted-2026-11-17T16-30-55.png");
    expect(pasted?.type).toBe("image/png");
  });

  it("reads clipboardData off a paste event and keeps real names", () => {
    const transfer: MediaTransfer = {
      files: [file("demo.mp4", "video/mp4"), file("logo.svg", "image/svg+xml")],
    };
    const files = mediaFilesFromClipboard({ clipboardData: transfer } as unknown as ClipboardEvent, NOW);
    expect(files.map((entry) => entry.name)).toEqual(["demo.mp4"]);
  });

  it("prefers files over items, so a screenshot isn't imported twice", () => {
    const screenshot = file("", "image/png");
    const files = mediaFilesFromClipboard({ files: [screenshot], items: [item(screenshot)] }, NOW);
    expect(files).toHaveLength(1);
  });

  it("returns nothing for a text paste", () => {
    expect(mediaFilesFromClipboard({ files: [], items: [textItem] }, NOW)).toEqual([]);
    expect(mediaFilesFromClipboard({ clipboardData: null } as unknown as ClipboardEvent, NOW)).toEqual([]);
  });
});

describe("mediaFilesFromDrop", () => {
  it("keeps media files in order and drops the rest", () => {
    const files = mediaFilesFromDrop({
      files: [file("a.png", "image/png"), file("notes.txt", "text/plain"), file("b.mov", "video/quicktime")],
    });
    expect(files.map((entry) => entry.name)).toEqual(["a.png", "b.mov"]);
  });
});

describe("audioFilesFromDrop", () => {
  it("keeps audio and leaves video and images to the video tracks", () => {
    const transfer = {
      files: [file("bed.mp3", "audio/mpeg"), file("a.png", "image/png"), file("click.wav", "audio/wav")],
    };
    expect(audioFilesFromDrop(transfer).map((entry) => entry.name)).toEqual(["bed.mp3", "click.wav"]);
    expect(mediaFilesFromDrop(transfer).map((entry) => entry.name)).toEqual(["a.png"]);
  });
});

describe("pastedFileName", () => {
  it("numbers later files and uses the type's extension", () => {
    expect(pastedFileName("image/jpeg", NOW, 1)).toBe("pasted-2026-11-17T16-30-55-2.jpg");
  });
});
