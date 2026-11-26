# Agent

The editor's conversational agent: a thread you talk the video through with, which sees the project and whatever you
point it at. It discusses only for now; the storyboard composer still drafts boards.

| File | What it is |
| --- | --- |
| `agent-sidecar.tsx` | The sidecar: the agent frame in a column on the window's right edge that pushes the editor open and closed |
| `agent-thread.tsx` | The conversation, its empty state and starters, and the light markdown replies render with |
| `agent-input.tsx` | The composer, with the context chips in its header and the model picker |
| `model-picker.tsx` | Switches the studio's model (the same setting as AI settings) |
| `use-agent.ts` | The thread (kept per project in localStorage), streaming, and the context sent with each message |
| `agent-context.ts` | The context chips and the project description the agent reads |

The reply streams from `POST /api/projects/[id]/agent`, which calls `streamAgentReply` in the engine.

## Decided (from the prototype, November 2026)

Explored at `/proto/agent-shell` over four rounds; the prototype is deleted.

- **Shell:** cards on a recessed window (`--editor-shell`), 10 px around the window and between cards, the timeline
  full width under the storyboard, canvas and inspector. The project bar is the window's title bar: 48 pt, with the
  macOS window buttons centred in it (`traffic_light_position(18, 26)` in vaunt-window).
- **Resize handles:** the gap between two cards is the handle; nothing is drawn in it. Hovering or dragging lights
  the facing borders of both cards, mirrored, and only where a bordered card sits against the gap: the glow skips
  the gaps between cards and fades 14 px + 28 px before each rounded corner. A side with no border stays dark.
- **The agent is an extension, not a panel:** its own frame (the composer frame's material: a muted shell with the
  header on it, holding an inset card for the thread, composer under the card). Sidecar: a full-height column on
  the window's right edge, beside the whole editor. 360 px by default, 300–520, collapses when dragged well past
  its minimum. Hidden until opened (the title bar's Agent button, ⌘L, or the storyboard's agent button), so the
  editor starts clean; once opened it stays open across reloads.
- **Open and close push the editor:** the column's width eases (320 ms, `cubic-bezier(0.32, 0.72, 0, 1)`) and the
  frame fades with it (240 ms); the frame keeps its width and is revealed from the window edge. Dragging tracks the
  pointer with no easing; reduced motion opens and closes instantly. ⌘L, the title bar's Agent button or the
  frame's ×.
- **Context:** chips in the composer header. The project is always attached; the selected clip and the playhead
  (when paused) attach on their own and can be removed. Starters change to clip prompts when a clip is selected.
- **Model picker** in the composer, writing the global AI setting; ⌘I opens AI settings.

## Empty storyboard (decided from the prototype, November 2026)

Explored at `/proto/empty-storyboard` (in place, in the Storyboard card) over three rounds; the prototype is deleted.

- **Annotated:** the real canvas stays (dots, toolbar, add menu) and draws an example board with the real scene and
  transition components, faded to 50% and inert: "1 · Introducing vaunt" → "2 · Open Links" → "3 · End card",
  scenes 132 px apart so three read at the card's size. A card at the bottom splits the example prompt into numbered
  parts ("Start with 'Introducing vaunt'," / "then click a few links in the sidebar" / "(and an end card)"), so each
  part maps to a numbered scene; then "Plan with the agent ⌘L" and "or add a scene by hand".
- **The handoff:** the button opens the agent (pushing the editor if it's closed) and puts the cursor in its input.
- **One agent:** the storyboard composer is gone, with its length dropdown and theme switch. The agent drafts and
  revises the board and asks for the length and the recording theme in the conversation, with quick replies.
  Drafts apply at once with an Undo on the agent's card; only the author starts Generate.

## Rejected

- **Agent and Inspect as tabs of the right card** (Tabs): the agent felt like part of the inspector rather than
  something added to the editor; you couldn't read a reply and a clip's settings at once.
- **A dock column on the left** (Dock), **a floating composer over the canvas** (Float) and **a composer pinned
  under both tabs** (Docked): Docked was indistinguishable from Tabs until you inspected; Float covered the canvas.
- **Flush native sidebars** (Native, Split, Agent left): sidebars sitting straight on the chrome read as unfinished;
  only the idea of the agent not being a card survived, as the frame.
- **Clip-on** (the frame under the inspector, growing upward) and **Summoned** (floating over the workspace on
  ⌘L): Summoned covered the work; the sidecar is better when it pushes rather than overlaps.
- **One splitter line between cards:** the glow belongs on the cards' own borders.
- **Empty state without the canvas** (an illustrated card, an outline of scene slots, a quiet question with
  examples): losing the board made the card stop reading as a storyboard.
- **Illustrations from the onboarding** (a contact sheet of recording stills, the tilted device with scene pins, a
  ghost board drawn as an illustration): decorative at 270 px, and they didn't explain what to type.
- **Example** (the faded board with its prompt and "Try this prompt") and **Seeded** (every project starting with an
  intro scene): Annotated teaches the mapping from words to scenes; seeding is a product decision for later.
