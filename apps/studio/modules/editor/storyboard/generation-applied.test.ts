import { describe, expect, it } from "vitest";
import { appliedScenes, saveAppliedScenes } from "./generation-applied";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("applied generation scenes", () => {
  it("remembers the scenes applied from a job", () => {
    const storage = memoryStorage();
    saveAppliedScenes(storage, "p1", "job-1", new Set(["ask", "approve"]));
    expect([...appliedScenes(storage, "p1", "job-1")]).toEqual(["ask", "approve"]);
  });

  it("starts empty for a newer job and for another project", () => {
    const storage = memoryStorage();
    saveAppliedScenes(storage, "p1", "job-1", new Set(["ask"]));
    expect(appliedScenes(storage, "p1", "job-2").size).toBe(0);
    expect(appliedScenes(storage, "p2", "job-1").size).toBe(0);
  });
});
