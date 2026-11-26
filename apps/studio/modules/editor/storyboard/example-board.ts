import type { Board } from "@coss/vaunt-engine/storyboard/board-schema";
import { STUDIO_COPY } from "../../studio-copy";

/** Closer than a drafted board's rows, so three scenes read at the sidebar card's size. */
const EXAMPLE_ROW = 132;

/**
 * The board the empty storyboard shows, faded, to teach the shape: each scene numbered by the part of the example
 * prompt it comes from.
 */
export function exampleBoard(): Board {
  const { intro, links, end } = STUDIO_COPY.storyboard.empty.example;
  const at = (row: number) => ({ x: 0, y: row * EXAMPLE_ROW });
  return {
    brief: STUDIO_COPY.storyboard.empty.parts.join(" "),
    nodes: [
      {
        id: "intro",
        kind: "text",
        title: `1 · ${intro.title}`,
        notes: "",
        duration: 2,
        words: intro.words,
        position: at(0),
      },
      {
        id: "links",
        kind: "recording",
        title: `2 · ${links.title}`,
        notes: links.notes,
        duration: 4,
        route: "/home",
        startFrom: "fresh",
        position: at(1),
      },
      {
        id: "end",
        kind: "text",
        title: `3 · ${end.title}`,
        notes: "",
        duration: 2,
        words: end.words,
        position: at(2),
      },
    ],
    edges: [
      { id: "intro-links", from: "intro", to: "links", transition: "zoom-through", transitionSeconds: 0.4 },
      { id: "links-end", from: "links", to: "end", transition: "cross-blur", transitionSeconds: 0.4 },
    ],
  };
}
