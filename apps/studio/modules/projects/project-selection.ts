export type ProjectSelection = { ids: readonly string[]; anchor: string | null };

export const EMPTY_PROJECT_SELECTION: ProjectSelection = { ids: [], anchor: null };

/** ⌘/Ctrl-click toggles one project; Shift-click selects the range from the last one clicked, in page order. */
export function selectProject(
  selection: ProjectSelection,
  order: readonly string[],
  id: string,
  { range }: { range: boolean }
): ProjectSelection {
  const from = selection.anchor ? order.indexOf(selection.anchor) : -1;
  const to = order.indexOf(id);
  if (range && from !== -1 && to !== -1) {
    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);
    return { ids: [...new Set([...selection.ids, ...span])], anchor: selection.anchor };
  }
  const ids = selection.ids.includes(id)
    ? selection.ids.filter((other) => other !== id)
    : [...selection.ids, id];
  return { ids, anchor: id };
}

/** Drops projects that no longer exist, so a refreshed list never keeps a deleted id selected. */
export function pruneProjectSelection(
  selection: ProjectSelection,
  order: readonly string[]
): ProjectSelection {
  const ids = selection.ids.filter((id) => order.includes(id));
  const anchor = selection.anchor && order.includes(selection.anchor) ? selection.anchor : null;
  return ids.length === selection.ids.length && anchor === selection.anchor ? selection : { ids, anchor };
}

export type ProjectClickIntent = "open" | "toggle" | "range";

/** Cards aren't links, so modifier clicks are ours: ⌘/Ctrl toggles, Shift selects a range, and while selecting a plain click toggles. */
export function projectClickIntent(
  click: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  selecting: boolean
): ProjectClickIntent {
  if (click.shiftKey) return "range";
  if (click.metaKey || click.ctrlKey || selecting) return "toggle";
  return "open";
}

export type Box = { left: number; top: number; right: number; bottom: number };

/** The ids of the cards a drag-selection box touches. */
export function idsInBox(box: Box, cards: readonly { id: string; rect: Box }[]): string[] {
  return cards
    .filter(
      ({ rect }) =>
        rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top
    )
    .map(({ id }) => id);
}
