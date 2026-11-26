"use client";

import { Button } from "@coss/ui/components/button";
import { Kbd } from "@coss/ui/components/kbd";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@coss/ui/components/menu";
import { SparklesIcon } from "@coss/ui/icons";
import { BOARD_NODE_KINDS, type BoardNodeKind } from "@coss/vaunt-engine/storyboard/board-schema";
import type * as React from "react";
import { comboKeys, KEYMAP } from "../editor-keymap";
import { useIsMac } from "../use-is-mac";
import { SCENE_ICONS } from "./scene-node";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.storyboard;

/**
 * The storyboard before it has scenes: the canvas draws an example board, faded and inert, and this card says how
 * to get one. The example prompt is split into numbered parts, each the scene with that number, so it teaches how a
 * description becomes scenes. Then the way in: the agent, or a scene added by hand.
 */
export function StoryboardEmpty({
  canvas,
  onPlanWithAgent,
  onAddScene,
}: {
  /** The real canvas, drawing the example board. */
  canvas: React.ReactNode;
  onPlanWithAgent: () => void;
  onAddScene: (kind: BoardNodeKind) => void;
}): React.ReactElement {
  const mac = useIsMac();
  const agentKeys = comboKeys(
    KEYMAP.find((binding) => binding.action === "toggle-agent")?.combos[0] ?? {},
    mac
  );
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-slot="storyboard-empty">
      <div className="flex min-h-0 flex-1 flex-col" data-slot="storyboard-example">
        {canvas}
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
        <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl bg-popover/94 p-3 shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_8%,transparent),0_16px_40px_-16px_rgb(0_0_0/0.55)] backdrop-blur-md">
          <p className="text-[11px] text-muted-foreground">{copy.empty.lead}</p>
          <ol className="flex flex-col gap-1">
            {copy.empty.parts.map((part, index) => (
              <li className="flex items-baseline gap-2 text-[12.5px] leading-snug" key={part}>
                <span className="grid size-4 shrink-0 translate-y-0.5 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span
                  className={
                    index === copy.empty.parts.length - 1 ? "text-muted-foreground" : "text-foreground"
                  }>
                  {part}
                </span>
              </li>
            ))}
          </ol>
          <Button className="w-full" onClick={onPlanWithAgent}>
            <SparklesIcon aria-hidden="true" />
            {copy.empty.plan}
            <Kbd className="ms-1 bg-primary-foreground/12 text-primary-foreground/72">
              {agentKeys.join(mac ? "" : "+")}
            </Kbd>
          </Button>
          <div className="-mt-0.5 flex justify-center">
            <Menu>
              <MenuTrigger
                render={
                  <button
                    className="rounded-sm text-muted-foreground text-xs underline decoration-muted-foreground/40 underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-foreground/40 focus-visible:outline-2 focus-visible:outline-ring"
                    type="button"
                  />
                }>
                {copy.empty.byHand}
              </MenuTrigger>
              <MenuPopup align="center">
                {BOARD_NODE_KINDS.map((kind) => {
                  const Icon = SCENE_ICONS[kind];
                  return (
                    <MenuItem key={kind} onClick={() => onAddScene(kind)}>
                      <Icon aria-hidden="true" />
                      {copy.kinds[kind]}
                    </MenuItem>
                  );
                })}
              </MenuPopup>
            </Menu>
          </div>
        </div>
      </div>
    </div>
  );
}
