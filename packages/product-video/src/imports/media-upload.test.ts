import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaProbe } from "./media-probe";
import { MAX_IMAGE_BYTES } from "./media-types";
import {
  clipFromMedia,
  importUploadedMedia,
  planVideoConversion,
  probeMatchesKind,
  sanitizeMediaFileName,
} from "./media-upload";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

type Callback = (error: Error | null, stdout: string, stderr: string) => void;

const h264: MediaProbe = {
  formatName: "mov,mp4,m4a,3gp,3g2,mj2",
  duration: 5,
  width: 640,
  height: 360,
  videoCodec: "h264",
  pixelFormat: "yuv420p",
  hasAudio: true,
  rotated: false,
};

function ffprobeJson({ codec, width, height, duration, format }: Record<string, string | number>): string {
  return JSON.stringify({
    streams: [{ codec_type: "video", codec_name: codec, width, height, pix_fmt: "yuv420p" }],
    format: { format_name: format, ...(duration ? { duration: String(duration) } : {}) },
  });
}

function bodyOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

describe("sanitizeMediaFileName", () => {
  it.each([
    ["My Clip (final).mov", ".mp4", "My-Clip-final.mp4"],
    ["../../etc/passwd.png", ".png", "passwd.png"],
    ["C:\\Users\\me\\shot.png", ".png", "shot.png"],
    [".hidden.png", ".png", "hidden.png"],
    ["Café déjà vu.jpg", ".jpg", "Cafe-deja-vu.jpg"],
    ["😀.png", ".png", "media.png"],
    ["", ".webp", "media.webp"],
  ])("turns %s into a safe name", (name, extension, expected) => {
    expect(sanitizeMediaFileName(name, extension)).toBe(expected);
  });

  it("caps long names", () => {
    expect(sanitizeMediaFileName(`${"a".repeat(300)}.png`, ".png")).toBe(`${"a".repeat(80)}.png`);
  });
});

describe("planVideoConversion", () => {
  it("keeps playable MP4 and WebM, rewraps playable MOV and re-encodes the rest", () => {
    expect(planVideoConversion(h264, ".mp4")).toBe("none");
    expect(planVideoConversion({ ...h264, videoCodec: "vp9" }, ".webm")).toBe("none");
    expect(planVideoConversion(h264, ".mov")).toBe("remux");
    expect(planVideoConversion({ ...h264, videoCodec: "hevc" }, ".mov")).toBe("transcode");
    expect(planVideoConversion({ ...h264, pixelFormat: "yuv420p10le" }, ".mp4")).toBe("transcode");
    expect(planVideoConversion({ ...h264, videoCodec: "prores" }, ".mov")).toBe("transcode");
    expect(planVideoConversion({ ...h264, rotated: true }, ".mp4")).toBe("transcode");
  });
});

describe("probeMatchesKind", () => {
  it("tells images from video", () => {
    const png = { ...h264, formatName: "png_pipe", duration: null, videoCodec: "png" };
    expect(probeMatchesKind(png, "image")).toBe(true);
    expect(probeMatchesKind(png, "video")).toBe(false);
    expect(probeMatchesKind(h264, "image")).toBe(false);
    expect(probeMatchesKind(h264, "video")).toBe(true);
  });
});

describe("clipFromMedia", () => {
  it("makes a 3 s image clip", () => {
    const clip = clipFromMedia({
      id: "c1",
      name: "shot.png",
      file: "imports/x-shot.png",
      kind: "image",
      probe: { ...h264, duration: null, videoCodec: "png", width: 800, height: 600 },
    });
    expect(clip).toMatchObject({
      name: "shot.png",
      start: 0,
      duration: 3,
      source: { kind: "image", file: "imports/x-shot.png", width: 800, height: 600 },
    });
  });

  it("makes an import clip of the whole file, capped at 60 s", () => {
    const short = clipFromMedia({
      id: "c1",
      name: "a.mp4",
      file: "imports/a.mp4",
      kind: "video",
      probe: h264,
    });
    expect(short).toMatchObject({ duration: 5, source: { kind: "import", trimStart: 0, fileDuration: 5 } });
    const long = clipFromMedia({
      id: "c2",
      name: "b.mp4",
      file: "imports/b.mp4",
      kind: "video",
      probe: { ...h264, duration: 600 },
    });
    expect(long).toMatchObject({ duration: 60, source: { fileDuration: 600 } });
  });
});

describe("importUploadedMedia", () => {
  let projectDir = "";
  const execFileMock = vi.mocked(execFile);
  const respond = (handler: (file: string, args: string[]) => string | Promise<string>) => {
    execFileMock.mockImplementation(((
      file: string,
      args: string[],
      _options: unknown,
      callback: Callback
    ) => {
      void Promise.resolve(handler(file, args)).then((stdout) => callback(null, stdout, ""));
      return {};
    }) as unknown as typeof execFile);
  };

  beforeEach(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "media-upload-"));
    execFileMock.mockReset();
  });
  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("stores an image under imports/ and returns an image clip", async () => {
    respond(() => ffprobeJson({ codec: "png", width: 800, height: 600, format: "png_pipe" }));
    const { clip, conversion } = await importUploadedMedia({
      projectDir,
      name: "Screen Shot.png",
      mime: "image/png",
      body: bodyOf("fake", "png"),
    });
    expect(conversion).toBe("none");
    expect(clip.source).toMatchObject({ kind: "image", width: 800, height: 600 });
    const file = clip.source.kind === "image" ? clip.source.file : "";
    expect(file).toMatch(/^imports\/[0-9a-f-]{36}-Screen-Shot\.png$/);
    expect(await readdir(path.join(projectDir, "imports"))).toEqual([path.basename(file)]);
    const [binary, args] = execFileMock.mock.calls[0] ?? [];
    expect(binary).toBe("ffprobe");
    expect(args).toContain("--");
  });

  it("transcodes HEVC to an MP4 and reports it", async () => {
    respond((binary, args) => {
      if (binary === "ffmpeg") return writeFile(args[args.length - 1] ?? "", "converted").then(() => "");
      const converted = (args[args.length - 1] ?? "").endsWith(".converted.mp4");
      return ffprobeJson({
        codec: converted ? "h264" : "hevc",
        width: 1920,
        height: 1080,
        duration: 12,
        format: "mov,mp4,m4a,3gp,3g2,mj2",
      });
    });
    const { clip, conversion } = await importUploadedMedia({
      projectDir,
      name: "iphone.mov",
      mime: "video/quicktime",
      body: bodyOf("fake mov"),
    });
    expect(conversion).toBe("transcode");
    expect(clip).toMatchObject({ duration: 12, source: { kind: "import", fileDuration: 12 } });
    expect(clip.source.kind === "import" && clip.source.file.endsWith("-iphone.mp4")).toBe(true);
    const ffmpegArgs = execFileMock.mock.calls.find(([binary]) => binary === "ffmpeg")?.[1];
    expect(ffmpegArgs).toEqual(expect.arrayContaining(["libx264", "yuv420p"]));
    expect(await readdir(path.join(projectDir, "imports"))).toHaveLength(1);
  });

  it("refuses an unsupported type before writing anything", async () => {
    await expect(
      importUploadedMedia({ projectDir, name: "logo.svg", mime: "image/svg+xml", body: bodyOf("<svg/>") })
    ).rejects.toMatchObject({ code: "unsupported-type" });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("refuses a declared size over the cap", async () => {
    await expect(
      importUploadedMedia({
        projectDir,
        name: "big.png",
        mime: "image/png",
        body: bodyOf("x"),
        declaredBytes: MAX_IMAGE_BYTES + 1,
      })
    ).rejects.toMatchObject({ code: "too-large" });
  });

  it("cleans up when the bytes aren't the claimed kind", async () => {
    respond(() => ffprobeJson({ codec: "png", width: 10, height: 10, format: "png_pipe" }));
    await expect(
      importUploadedMedia({ projectDir, name: "clip.mp4", mime: "video/mp4", body: bodyOf("png bytes") })
    ).rejects.toMatchObject({ code: "unreadable" });
    expect(await readdir(path.join(projectDir, "imports"))).toEqual([]);
  });

  it("rejects an empty file", async () => {
    await expect(
      importUploadedMedia({ projectDir, name: "a.png", mime: "image/png", body: bodyOf() })
    ).rejects.toMatchObject({ code: "empty" });
    expect(await readdir(path.join(projectDir, "imports"))).toEqual([]);
  });
});
