import { describe, expect, it } from "vitest";
import { scriptedReplyFixtureSchema } from "../../recording/scripted-reply";
import bookSandyOneOnOne from "./fixtures/book-sandy-one-on-one.json";
import { findRouteEntry, ROUTE_CATALOGUE } from "./route-catalogue";

describe("ROUTE_CATALOGUE", () => {
  it("has unique routes and unique targets per route", () => {
    expect(new Set(ROUTE_CATALOGUE.map((entry) => entry.route)).size).toBe(ROUTE_CATALOGUE.length);
    for (const entry of ROUTE_CATALOGUE) {
      expect(new Set(entry.targets.map((target) => target.selector)).size).toBe(entry.targets.length);
    }
  });

  it("signs in only as seeded example.com users", () => {
    for (const entry of ROUTE_CATALOGUE) expect(entry.login.email).toMatch(/@example\.com$/);
  });

  it("finds /home whatever the query string", () => {
    expect(findRouteEntry("/home?session=abc")?.label).toBe("Home · Main Agent");
    expect(findRouteEntry("/bookings")).toBeNull();
  });
});

describe("book-sandy-one-on-one fixture", () => {
  it("parses and ends its first turn on a booking approval", () => {
    const fixture = scriptedReplyFixtureSchema.parse(bookSandyOneOnOne);
    const lastStep = fixture.turns[0].steps.at(-1);
    expect(lastStep?.at(-1)).toMatchObject({ kind: "approval", toolName: "create_booking" });
  });
});
