"use client";

import { Button } from "@coss/ui/components/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@coss/ui/components/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { PlusIcon } from "@coss/ui/icons";
import { PROPERTY_SPECS, type PropertyKey } from "@coss/vaunt-engine/storyboard/property-specs";
import type * as React from "react";
import { keysInGroup, PROPERTY_GROUP_ORDER } from "./keyframed-properties";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline.menu;

/** Opens a lane for a property that has no keyframes yet, so the first one can be added on the timeline. */
export function AddLaneMenu({
  shown,
  onShowLane,
}: {
  shown: readonly PropertyKey[];
  onShowLane: (key: PropertyKey) => void;
}): React.ReactElement {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button aria-label={copy.addLane} data-testid="add-lane" size="icon-xs" variant="ghost" />
              }
            />
          }>
          <PlusIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipPopup>{copy.addLane}</TooltipPopup>
      </Tooltip>
      <MenuPopup align="start">
        {PROPERTY_GROUP_ORDER.map((group, index) => (
          <MenuGroup key={group}>
            {index > 0 ? <MenuSeparator /> : null}
            <MenuGroupLabel>{copy.groups[group]}</MenuGroupLabel>
            {keysInGroup(group).map((key) => (
              <MenuItem disabled={shown.includes(key)} key={key} onClick={() => onShowLane(key)}>
                {PROPERTY_SPECS[key].label}
              </MenuItem>
            ))}
          </MenuGroup>
        ))}
      </MenuPopup>
    </Menu>
  );
}
