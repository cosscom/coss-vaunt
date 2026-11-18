import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureRecordingTake } from "./link-recording-take";

const HASH = "0123456789abcdef";
let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(path.join(tmpdir(), "take-"));
  const take = path.join(projectDir, "recordings", "original", HASH);
  await mkdir(path.join(take, "frames"), { recursive: true });
  await writeFile(path.join(take, "frames", "000000.png"), "frame");
  await writeFile(path.join(take, "manifest.json"), JSON.stringify({ clipId: "original", frameCount: 1 }));
});

afterEach(() => rm(projectDir, { recursive: true, force: true }));

describe("ensureRecordingTake", () => {
  it("links a copied clip's take from the clip that recorded the same hash", async () => {
    expect(await ensureRecordingTake({ projectDir, clipId: "copy", captureHash: HASH })).toBe(true);
    const copy = path.join(projectDir, "recordings", "copy", HASH);
    const manifest = JSON.parse(await readFile(path.join(copy, "manifest.json"), "utf8"));
    expect(manifest.clipId).toBe("copy");
    const [linked, source] = await Promise.all([
      stat(path.join(copy, "frames", "000000.png")),
      stat(path.join(projectDir, "recordings", "original", HASH, "frames", "000000.png")),
    ]);
    expect(linked.ino).toBe(source.ino);
  });

  it("finds nothing when no clip recorded the hash", async () => {
    expect(await ensureRecordingTake({ projectDir, clipId: "copy", captureHash: "ffffffffffffffff" })).toBe(
      false
    );
  });
});
