# Agent

The editor's conversational agent: a thread you talk the video through with, which sees the project and whatever you
point it at, drafts the storyboard and edits it.

| File | What it is |
| --- | --- |
| `agent-sidecar.tsx` | The sidecar: the agent card in a column on the window's right edge that pushes the editor open and closed |
| `agent-thread.tsx` | The conversation, its empty state and starters, the change cards (Undo, Generate, "Why these scenes"), and the light markdown replies render with |
| `agent-input.tsx` | The composer, with the context chips in its header and the model picker |
| `model-picker.tsx` | Switches the studio's model among the connected providers' (the same setting as Settings › AI) |
| `use-agent.ts` | The thread, streaming, applying the agent's events with an Undo each, and the context sent with each message |
| `agent-events.ts` | Parsing the event stream, the board an event leaves, and how a past turn reads back to the agent |
| `thread-storage.ts` | Loading and saving the thread through the API, and moving an old localStorage thread over once |
| `agent-context.ts` | The context chips and the project description the agent reads (scenes in story order, with ids and transitions) |

The reply streams from `POST /api/projects/[id]/agent`, which calls `streamAgentEvents` in the engine
(`packages/product-video/src/ai/agent-chat.ts`); the agent follows the video-director skill in `ai/skills`.

## Tools

The agent picks the smallest tool that does the job. Each one reports an event the studio applies at once, with an
Undo on the agent's card, and returns the scenes in their new order so several edits in a turn build on each other.

| Tool | Event | What it does |
| --- | --- | --- |
| `draftStoryboard` | `board` | The whole board from the request, by the high-effort planner (`ai/board-draft.ts`); comes with the planner's `rationale` |
| `editScene` | `scene` | A typed patch of one scene's fields (title, notes, duration, words, effect, route, startFrom) |
| `setSceneDuration` | `scene` | One scene's length |
| `addScene`, `removeScene`, `moveScene` | `edit` | A scene in or out of story order, or to a new position; the chain rejoins and the board is laid out again |
| `setTransition` | `edit` | The kind and seconds of the transition between two consecutive scenes |
| `askAuthor`, `setTheme` | `ask`, `theme` | A question with quick replies (ends the turn); light or dark recording |

The direct edits live in `ai/scene-edits.ts`. They change nothing else: a patch touches one scene, and other scenes
keep their ids and fields (except that the first recording always starts fresh). They're held to the same rules as a
draft (`sceneRuleErrors` in `board-draft.ts`: app paths, known text effects, the recording cap), and a broken edit
goes back to the model as `failed` with the reason, so it can fix it.

## The thread

Kept per project in `agent-thread.json` beside `project.json` (`project-store/agent-thread-store.ts`), through
`GET`/`PUT /api/projects/[id]/agent/thread`: loaded when the editor opens and saved after each turn and each undo.
A thread from before, in this browser's localStorage, moves to the project the first time it opens without one.
Each change keeps the board it replaced, for its Undo; a draft keeps the planner's reasons, which read back to the
agent in later turns so it can say why a scene is there.

## Decided (from the prototype, November 2026)

Explored at `/proto/agent-shell` over four rounds; the prototype is deleted.

- **Shell:** cards on a recessed window (`--editor-shell`), 10 px around the window and between cards, the timeline
  full width under the storyboard, canvas and inspector. The project bar is the window's title bar: 48 pt, with the
  macOS window buttons centred in it (`traffic_light_position(18, 26)` in vaunt-window).
- **Resize handles:** the gap between two cards is the handle; nothing is drawn in it. Hovering or dragging lights
  the facing borders of both cards, mirrored, and only where a bordered card sits against the gap: the glow skips
  the gaps between cards and fades 14 px + 28 px before each rounded corner. A side with no border stays dark.
- **The agent is one of the editor's cards** (November 2026, replacing its own muted frame): bordered like the
  inspector beside it, a plain "Agent" header (no icon), the thread, and the composer set into the card's bottom
  4 px from its edge, its corners following the card's (`data-snug` math: card radius − border − inset; the
  composer 2 px tighter than its chip shelf). The frame read as a dark slab sitting above the composer. Sidecar: a full-height column on
  the window's right edge, beside the whole editor. 360 px by default, 300–520, collapses when dragged well past
  its minimum. Hidden until opened (the title bar's Agent button, ⌘L, or the storyboard's agent button), so the
  editor starts clean; once opened it stays open across reloads.
- **Open and close push the editor:** the column's width eases (320 ms, `cubic-bezier(0.32, 0.72, 0, 1)`) and the
  frame fades with it (240 ms); the frame keeps its width and is revealed from the window edge. Dragging tracks the
  pointer with no easing; reduced motion opens and closes instantly. ⌘L, the title bar's Agent button (a label, no
  icon) or the frame's ×. The storyboard panel and the inspector open and close the same way, from their own edges
  (`editor/layout/push-panel.tsx`, with the easing state in `use-panel-layout.ts`).
- **Context:** chips in the composer header. The project is always attached; the selected clip and the playhead
  (when paused) attach on their own and can be removed. Starters change to clip prompts when a clip is selected.
- **Model picker** in the composer, writing the global AI setting; "AI settings…" (⌘,) opens Settings at AI
  (see `modules/settings/README.md`).

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
