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
  its minimum.
- **Open and close push the editor:** the column's width eases (320 ms, `cubic-bezier(0.32, 0.72, 0, 1)`) and the
  frame fades with it (240 ms); the frame keeps its width and is revealed from the window edge. Dragging tracks the
  pointer with no easing; reduced motion opens and closes instantly. ⌘L, the title bar's Agent button or the
  frame's ×.
- **Context:** chips in the composer header. The project is always attached; the selected clip and the playhead
  (when paused) attach on their own and can be removed. Starters change to clip prompts when a clip is selected.
- **Model picker** in the composer, writing the global AI setting; ⌘I opens AI settings.

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
