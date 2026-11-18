import { describe, expect, it } from "vitest";
import { PAGE_OPTIONS, pageMatches } from "./page-options";

describe("PAGE_OPTIONS", () => {
  it("lists each path once", () => {
    const paths = PAGE_OPTIONS.map((option) => option.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/bookings/past");
  });
});

describe("pageMatches", () => {
  const option = { path: "/bookings/upcoming", label: "Bookings · Upcoming" };

  it("matches the path or the label, ignoring case", () => {
    expect(pageMatches(option, "upcom")).toBe(true);
    expect(pageMatches(option, "BOOKINGS ·")).toBe(true);
    expect(pageMatches(option, "/apps")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(pageMatches(option, "  ")).toBe(true);
  });
});
