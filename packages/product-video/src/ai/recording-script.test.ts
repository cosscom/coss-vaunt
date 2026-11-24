import { describe, expect, it } from "vitest";
import { recordingExplorerSystemPrompt, recordingExplorerUserPrompt } from "./recording-explorer-prompt";
import { type RecordingScript, scriptErrors } from "./recording-script";

const composer = "[data-testid=ai-chat-input]";

const script = (actions: RecordingScript["actions"]): RecordingScript => ({ actions });

describe("scriptErrors", () => {
  it("accepts a script that fits the clip", () => {
    expect(
      scriptErrors(
        script([
          { kind: "click", at: 0.8, target: composer },
          { kind: "type", at: 1, target: composer, text: "Book Sandy" },
          { kind: "press", at: 2, key: "Enter" },
        ]),
        { duration: 6 }
      )
    ).toEqual([]);
  });

  it("flags typing that runs past the clip or into the next action", () => {
    const errors = scriptErrors(
      script([
        { kind: "type", at: 1, target: composer, text: "a".repeat(60) },
        { kind: "press", at: 2, key: "Enter" },
      ]),
      { duration: 3 }
    );
    expect(errors).toEqual([
      "Action 0 (type) ends at 4.00 s, after the 3 s clip",
      "Action 1 (press) at 2 s starts before action 0 finishes at 4.00 s",
    ]);
  });

  it("flags refs, empty text and odd keys", () => {
    const errors = scriptErrors(
      script([
        { kind: "click", at: 0.5, target: "@e3" },
        { kind: "type", at: 1, target: composer, text: " " },
        { kind: "press", at: 2, key: "enter key" },
      ]),
      { duration: 5 }
    );
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/snapshot ref @e3/);
  });
});

describe("recording explorer prompts", () => {
  it("names the scene's page, the author's notes and whether it is signed in", () => {
    const system = recordingExplorerSystemPrompt({
      route: "/projects",
      appNotes: "Billing is off limits.",
      signedIn: true,
    });
    expect(system).toContain("The scene opens on /projects.");
    expect(system).toContain("<app-notes>\nBilling is off limits.\n</app-notes>");
    expect(system).toContain("signed in with the author's test account");
    expect(system).toContain("must already be on screen when the cursor sets off");
    const publicApp = recordingExplorerSystemPrompt({ route: "/", signedIn: false });
    expect(publicApp).not.toContain("signed in");
    expect(publicApp).not.toContain("<app-notes>");
  });

  it("describes where a continuing scene starts", () => {
    const node = {
      id: "n",
      kind: "recording" as const,
      title: "Approve",
      notes: "Approve the booking",
      duration: 5,
      position: { x: 0, y: 0 },
      route: "/home",
      startFrom: "previous" as const,
    };
    expect(recordingExplorerUserPrompt({ node, previous: null })).toContain("freshly opened at /home");
    const continuing = recordingExplorerUserPrompt({
      node,
      previous: { title: "Ask", notes: "Send it", actions: [{ kind: "press", at: 1, key: "Enter" }] },
    });
    expect(continuing).toContain('previous scene, "Ask"');
    expect(continuing).toContain('"key":"Enter"');
  });

  it("gives a scene with no notes the video brief to follow", () => {
    const blank = {
      id: "n",
      kind: "recording" as const,
      title: "Bookings",
      notes: "",
      duration: 5,
      position: { x: 0, y: 0 },
      route: "/home",
      startFrom: "fresh" as const,
    };
    const prompt = recordingExplorerUserPrompt({ node: blank, previous: null, brief: "Open bookings" });
    expect(prompt).toContain("Direction: Follow the video brief.");
    expect(prompt).toContain("Video brief: Open bookings");
  });
});
