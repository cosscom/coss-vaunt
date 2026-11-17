import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePeaksFile } from "../audio/waveform-peaks";
import { type AudioProbe, parseAudioProbe } from "./audio-probe";
import { audioClipFromProbe, importUploadedAudio, planAudioConversion } from "./audio-upload";
import { ACCEPTED_AUDIO, ACCEPTED_MEDIA, MAX_AUDIO_BYTES, mediaTypeOf } from "./media-types";

vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

type Callback = (error: Error | null, stdout: string, stderr: string) => void;

const mp3: AudioProbe = { formatName: "mp3", duration: 20, codec: "mp3", sampleRate: 44100, channels: 2 };

function ffprobeJson(codec: string, duration: number): string {
  return JSON.stringify({
    streams: [{ codec_type: "audio", codec_name: codec, sample_rate: "48000", channels: 2 }],
    format: { format_name: "x", duration: String(duration) },
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

describe("audio media types", () => {
  it.each([
    ["bed.mp3", "audio/mpeg", ".mp3"],
    ["voice.m4a", "audio/x-m4a", ".m4a"],
    ["click.wav", "audio/wav", ".wav"],
    ["loop.ogg", "", ".ogg"],
    ["take.flac", "audio/flac", ".flac"],
  ])("accepts %s", (name, mime, extension) => {
    expect(mediaTypeOf(name, mime)).toEqual({ kind: "audio", extension });
  });

  it("keeps audio out of the video and image picker", () => {
    expect(ACCEPTED_AUDIO).toContain(".mp3");
    expect(ACCEPTED_MEDIA).not.toContain("audio");
    expect(mediaTypeOf("bed.mp3", "image/png")).toBeNull();
  });
});

describe("parseAudioProbe", () => {
  it("reads the first audio stream and the duration", () => {
    expect(parseAudioProbe(ffprobeJson("aac", 3.5))).toEqual({
      formatName: "x",
      duration: 3.5,
      codec: "aac",
      sampleRate: 48000,
      channels: 2,
    });
  });

  it("refuses a file without audio", () => {
    const video = JSON.stringify({
      streams: [{ codec_type: "video", codec_name: "h264" }],
      format: { duration: "3" },
    });
    expect(parseAudioProbe(video)).toBeNull();
  });
});

describe("planAudioConversion", () => {
  it("keeps MP3, PCM WAV and AAC M4A and re-encodes the rest", () => {
    expect(planAudioConversion(mp3, ".mp3")).toBe("none");
    expect(planAudioConversion({ ...mp3, codec: "pcm_s16le" }, ".wav")).toBe("none");
    expect(planAudioConversion({ ...mp3, codec: "aac" }, ".m4a")).toBe("none");
    expect(planAudioConversion({ ...mp3, codec: "alac" }, ".m4a")).toBe("transcode");
    expect(planAudioConversion({ ...mp3, codec: "vorbis" }, ".ogg")).toBe("transcode");
    expect(planAudioConversion({ ...mp3, codec: "flac" }, ".flac")).toBe("transcode");
  });
});

describe("audioClipFromProbe", () => {
  it("makes music over 15 s and a sound effect otherwise, at full volume", () => {
    const bed = audioClipFromProbe({ id: "a", name: "bed.mp3", file: "imports/bed.mp3", probe: mp3 });
    expect(bed).toMatchObject({
      kind: "music",
      duration: 20,
      fileDuration: 20,
      trimStart: 0,
      volume: { value: 1 },
    });
    const click = audioClipFromProbe({
      id: "b",
      name: "click.wav",
      file: "imports/c.wav",
      probe: { ...mp3, duration: 0.3 },
    });
    expect(click.kind).toBe("sfx");
  });
});

describe("importUploadedAudio", () => {
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
  const writePcm = (target: string) =>
    writeFile(target, Buffer.from(new Float32Array([0.5, -0.25, 0.1, 0]).buffer)).then(() => "");

  beforeEach(async () => {
    projectDir = await mkdtemp(path.join(tmpdir(), "audio-upload-"));
    execFileMock.mockReset();
  });
  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("keeps an MP3 and writes its peaks beside it", async () => {
    respond((binary, args) =>
      binary === "ffmpeg" ? writePcm(args[args.length - 1] ?? "") : ffprobeJson("mp3", 20)
    );
    const { audioClip, conversion } = await importUploadedAudio({
      projectDir,
      name: "Music Bed.mp3",
      mime: "audio/mpeg",
      body: bodyOf("fake mp3"),
    });
    expect(conversion).toBe("none");
    expect(audioClip.file).toMatch(/^imports\/[0-9a-f-]{36}-Music-Bed\.mp3$/);
    expect(audioClip.kind).toBe("music");
    const files = await readdir(path.join(projectDir, "imports"));
    expect(files.sort()).toEqual(
      [path.basename(audioClip.file), `${path.basename(audioClip.file)}.peaks.json`].sort()
    );
    const peaks = parsePeaksFile(
      JSON.parse(await readFile(path.join(projectDir, `${audioClip.file}.peaks.json`), "utf8"))
    );
    expect(peaks).toEqual({ bucketsPerSecond: 100, peaks: [-0.25, 0.5] });
    const pcmArgs = execFileMock.mock.calls.find(([binary]) => binary === "ffmpeg")?.[1];
    expect(pcmArgs).toEqual(expect.arrayContaining(["-ac", "1", "-ar", "8000", "-f", "f32le"]));
  });

  it("re-encodes Ogg to M4A", async () => {
    respond((binary, args) => {
      const output = args[args.length - 1] ?? "";
      if (binary === "ffmpeg")
        return output.endsWith(".pcm") ? writePcm(output) : writeFile(output, "m4a").then(() => "");
      return ffprobeJson(output.endsWith(".m4a") ? "aac" : "vorbis", 0.3);
    });
    const { audioClip, conversion } = await importUploadedAudio({
      projectDir,
      name: "click.ogg",
      mime: "audio/ogg",
      body: bodyOf("fake ogg"),
    });
    expect(conversion).toBe("transcode");
    expect(audioClip).toMatchObject({ kind: "sfx", duration: 0.3 });
    expect(audioClip.file.endsWith("-click.m4a")).toBe(true);
    expect(await readdir(path.join(projectDir, "imports"))).toHaveLength(2);
  });

  it("refuses video, oversized and unreadable uploads, leaving nothing behind", async () => {
    await expect(
      importUploadedAudio({ projectDir, name: "a.mp4", mime: "video/mp4", body: bodyOf("x") })
    ).rejects.toMatchObject({ code: "unsupported-type" });
    await expect(
      importUploadedAudio({
        projectDir,
        name: "a.mp3",
        mime: "audio/mpeg",
        body: bodyOf("x"),
        declaredBytes: MAX_AUDIO_BYTES + 1,
      })
    ).rejects.toMatchObject({ code: "too-large" });
    respond(() => JSON.stringify({ streams: [], format: {} }));
    await expect(
      importUploadedAudio({ projectDir, name: "a.wav", mime: "audio/wav", body: bodyOf("noise") })
    ).rejects.toMatchObject({ code: "unreadable" });
    expect(await readdir(path.join(projectDir, "imports"))).toEqual([]);
  });
});
