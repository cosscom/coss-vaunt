import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-17T12:00:00Z");

  it("says just now under a minute", () => {
    expect(formatRelativeTime("2026-11-17T11:59:30Z", now)).toBe("just now");
  });

  it("uses the largest whole unit", () => {
    expect(formatRelativeTime("2026-11-17T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-11-17T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-11-16T10:00:00Z", now)).toBe("yesterday");
  });
});
