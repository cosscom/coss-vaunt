import { describe, expect, it } from "vitest";
import { draftInput, draftReady, initialDraft, type NewProjectDraft, urlProblem } from "./new-project-draft";

const DEFAULT_URL = "http://localhost:3101";
const draft = (patch: Partial<NewProjectDraft>): NewProjectDraft => ({
  ...initialDraft(DEFAULT_URL),
  name: "Launch",
  ...patch,
});

describe("draftReady", () => {
  it("needs a name and, for a recorded app, an address on this machine", () => {
    expect(draftReady(draft({ name: "  " }))).toBe(false);
    expect(draftReady(draft({}))).toBe(true);
    expect(draftReady(draft({ calUrl: "https://cal.com" }))).toBe(false);
    expect(draftReady(draft({ app: "custom", customUrl: "" }))).toBe(false);
    expect(draftReady(draft({ app: "custom", customUrl: "http://app.localhost:3000" }))).toBe(true);
    expect(draftReady(draft({ app: "none", calUrl: "not a url" }))).toBe(true);
  });

  it("needs both login fields once a custom app signs in", () => {
    const custom = draft({ app: "custom", customUrl: "http://localhost:3000", signIn: true });
    expect(draftReady({ ...custom, username: "demo@example.com" })).toBe(false);
    expect(draftReady({ ...custom, username: "demo@example.com", password: "secret" })).toBe(true);
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
    expect(draftInput(draft({ app: "none", aspectRatio: "9:16" }), DEFAULT_URL)).toEqual({
      name: "Launch",
      setup: { aspectRatio: "9:16", app: { kind: "none" }, baseUrl: DEFAULT_URL },
    });
  });

  it("sends a custom app's login only when it signs in", () => {
    const custom = draft({
      app: "custom",
      customUrl: " http://localhost:3000 ",
      instructions: " Dashboard at /app ",
      username: "demo@example.com",
      password: "secret",
    });
    expect(draftInput(custom, DEFAULT_URL).setup).toEqual({
      aspectRatio: "16:9",
      app: { kind: "custom", instructions: "Dashboard at /app" },
      baseUrl: "http://localhost:3000",
    });
    expect(draftInput({ ...custom, signIn: true }, DEFAULT_URL).setup.login).toEqual({
      username: "demo@example.com",
      password: "secret",
    });
  });
});
