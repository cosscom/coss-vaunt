import { describe, expect, it } from "vitest";
import { assertAllowedRecordingHost, isAllowedRecordingHost } from "./host-allowlist";

describe("isAllowedRecordingHost", () => {
  it.each([
    "http://localhost:3101",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "https://cal.localhost",
    "http://app.cal.localhost:3101/",
    "http://LOCALHOST:3101",
  ])("allows %s", (url) => {
    expect(isAllowedRecordingHost(url)).toBe(true);
  });

  it.each([
    "https://app.cal.com",
    "https://localhost.cal.com",
    "http://localhost.evil.com",
    "http://127.0.0.2",
    "http://evil.com#@localhost",
    "http://localhost@evil.com",
    "http://user:pass@localhost:3101",
    "file:///etc/passwd",
    "localhost:3101",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isAllowedRecordingHost(url)).toBe(false);
  });

  it("throws naming the refused url", () => {
    expect(() => assertAllowedRecordingHost("https://app.cal.com")).toThrow("https://app.cal.com");
  });
});
