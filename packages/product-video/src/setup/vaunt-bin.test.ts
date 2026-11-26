import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executableName, findOnPath, vauntBinDir, vauntToolCopy } from "./vaunt-bin";

describe("vauntBinDir", () => {
  it("prefers VAUNT_BIN_DIR", () => {
    expect(vauntBinDir({ VAUNT_BIN_DIR: "/opt/tools", VAUNT_HOME: "/data" }, "/home/me")).toBe("/opt/tools");
  });

  it("falls back to $VAUNT_HOME/bin", () => {
    expect(vauntBinDir({ VAUNT_HOME: "/data" }, "/home/me")).toBe(path.resolve("/data/bin"));
  });

  it("defaults to ~/.vaunt/bin", () => {
    expect(vauntBinDir({}, "/home/me")).toBe(path.join("/home/me", ".vaunt", "bin"));
  });

  it("ignores empty variables", () => {
    expect(vauntBinDir({ VAUNT_BIN_DIR: "", VAUNT_HOME: "" }, "/home/me")).toBe(
      path.join("/home/me", ".vaunt", "bin")
    );
  });
});

describe("executableName", () => {
  it("adds .exe on Windows only", () => {
    expect(executableName("ffmpeg", "win32")).toBe("ffmpeg.exe");
    expect(executableName("ffmpeg", "darwin")).toBe("ffmpeg");
    expect(executableName("ffmpeg", "linux")).toBe("ffmpeg");
  });
});

describe.skipIf(process.platform === "win32")("finding tools", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("finds an executable copy in the bin dir, not a plain file", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "vaunt-bin-"));
    expect(vauntToolCopy("ffmpeg", { VAUNT_BIN_DIR: dir })).toBeNull();
    writeFileSync(path.join(dir, "ffmpeg"), "", { mode: 0o644 });
    expect(vauntToolCopy("ffmpeg", { VAUNT_BIN_DIR: dir })).toBeNull();
    writeFileSync(path.join(dir, "ffprobe"), "", { mode: 0o755 });
    expect(vauntToolCopy("ffprobe", { VAUNT_BIN_DIR: dir })).toBe(path.join(dir, "ffprobe"));
  });

  it("searches the PATH in order", () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "vaunt-path-"));
    const [first, second] = ["a", "b"].map((name) => path.join(dir, name));
    for (const sub of [first, second]) {
      mkdirSync(sub);
      writeFileSync(path.join(sub, "ffmpeg"), "", { mode: 0o755 });
    }
    expect(
      findOnPath("ffmpeg", { PATH: [path.join(dir, "missing"), second, first].join(path.delimiter) })
    ).toBe(path.join(second, "ffmpeg"));
    expect(findOnPath("ffprobe", { PATH: first })).toBeNull();
  });
});
