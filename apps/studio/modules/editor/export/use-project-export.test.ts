import { describe, expect, it } from "vitest";
import { nextExportState } from "./use-project-export";

describe("nextExportState", () => {
  it("follows an export from loading through frames to the file", () => {
    let state = nextExportState({ status: "starting" }, { type: "phase", phase: "load" });
    expect(state).toMatchObject({ status: "running", phase: "load" });
    state = nextExportState(state, {
      type: "frame",
      frame: 10,
      frameCount: 100,
      elapsedSeconds: 2,
      etaSeconds: 18,
    });
    expect(state).toMatchObject({
      status: "running",
      phase: "frames",
      frame: 10,
      frameCount: 100,
      etaSeconds: 18,
    });
    state = nextExportState(state, { type: "phase", phase: "encode" });
    expect(state).toMatchObject({ phase: "encode", frame: 10 });
    expect(nextExportState(state, { type: "done", file: "exports/a.mp4", bytes: 5, seconds: 3 })).toEqual({
      status: "done",
      file: "exports/a.mp4",
      bytes: 5,
    });
  });

  it("stays starting when the first poll finds nothing running yet, and reports errors", () => {
    expect(nextExportState({ status: "starting" }, { type: "idle" })).toEqual({ status: "starting" });
    expect(nextExportState({ status: "done", file: "f", bytes: 1 }, { type: "idle" })).toEqual({
      status: "idle",
    });
    expect(nextExportState({ status: "starting" }, { type: "error", message: "nope" })).toEqual({
      status: "error",
      message: "nope",
    });
  });
});
