import { describe, expect, it } from "vitest";
import { pageMatches, pageOptionsFrom } from "./page-options";

describe("pageOptionsFrom", () => {
  it("names each page by its link, else its title, else its path", () => {
    expect(
      pageOptionsFrom([
        { path: "/projects", label: "Projects", title: "All projects", inNav: true },
        { path: "/team", label: "", title: "Team · Acme", inNav: false },
        { path: "/raw", label: "", title: "", inNav: false },
      ])
    ).toEqual([
      { path: "/projects", label: "Projects" },
      { path: "/team", label: "Team · Acme" },
      { path: "/raw", label: "/raw" },
    ]);
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
