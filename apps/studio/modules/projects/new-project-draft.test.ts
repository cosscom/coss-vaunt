import { describe, expect, it } from "vitest";
import { draftInput, draftReady, initialDraft, type NewProjectDraft, urlProblem } from "./new-project-draft";

const DEFAULT_URL = "http://localhost:3000";
const TIMEZONE = "Europe/London";
const draft = (patch: Partial<NewProjectDraft>): NewProjectDraft => ({
  ...initialDraft(DEFAULT_URL),
  name: "Launch",
  ...patch,
});

describe("draftReady", () => {
  it("needs a name and, for a recorded app, an address on this machine", () => {
    expect(draftReady(draft({ name: "  " }))).toBe(false);
    expect(draftReady(draft({}))).toBe(true);
    expect(draftReady(draft({ url: "https://example.com" }))).toBe(false);
    expect(draftReady(draft({ url: "" }))).toBe(false);
    expect(draftReady(draft({ url: "http://app.localhost:3000" }))).toBe(true);
    expect(draftReady(draft({ app: "none", url: "not a url" }))).toBe(true);
  });

  it("needs both login fields once the app signs in", () => {
    const signingIn = draft({ signIn: true });
    expect(draftReady({ ...signingIn, username: "demo@example.com" })).toBe(false);
    expect(draftReady({ ...signingIn, username: "demo@example.com", password: "secret" })).toBe(true);
  });
});

describe("urlProblem", () => {
  it("stays quiet while empty and flags addresses off this machine", () => {
    expect(urlProblem("")).toBe(false);
    expect(urlProblem("http://localhost:3000")).toBe(false);
    expect(urlProblem("https://example.com")).toBe(true);
  });
});

describe("draftInput", () => {
  it("keeps the default address when skipping to local files", () => {
    expect(draftInput(draft({ app: "none", aspectRatio: "9:16" }), DEFAULT_URL, TIMEZONE)).toEqual({
      name: "Launch",
      setup: { aspectRatio: "9:16", app: { kind: "none" }, baseUrl: DEFAULT_URL },
    });
  });

  it("sends the author's timezone, and the app's login only when it signs in", () => {
    const web = draft({
      url: " http://localhost:4000 ",
      instructions: " Dashboard at /app ",
      username: "demo@example.com",
      password: "secret",
    });
    expect(draftInput(web, DEFAULT_URL, TIMEZONE).setup).toEqual({
      aspectRatio: "16:9",
      app: { kind: "web", instructions: "Dashboard at /app" },
      baseUrl: "http://localhost:4000",
      timezone: TIMEZONE,
    });
    expect(draftInput({ ...web, signIn: true }, DEFAULT_URL, TIMEZONE).setup.login).toEqual({
      username: "demo@example.com",
      password: "secret",
    });
  });
});
