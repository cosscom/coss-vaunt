"use client";

import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Card } from "@coss/ui/components/card";
import { Checkbox } from "@coss/ui/components/checkbox";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@coss/ui/components/menu";
import { EllipsisIcon, ExternalLinkIcon, PencilIcon, Trash2Icon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type { ProjectStill } from "@coss/vaunt-engine/project-store/project-still";
import type { ProjectSummary } from "@coss/vaunt-engine/project-store/project-store";
import Link from "next/link";
import type * as React from "react";
import { projectFileUrl } from "../editor/audio/project-file-url";
import { cssAspectRatio } from "./css-aspect-ratio";
import { projectClickIntent } from "./project-selection";
import { formatRelativeTime } from "./relative-time";
import { STUDIO_COPY } from "@/modules/studio-copy";

type ProjectCardProps = {
  project: ProjectSummary;
  now: Date;
  onRename: () => void;
  onDelete: () => void;
  onOpen: () => void;
  selected: boolean;
  still: ProjectStill | null;
  /** While any project is selected, a plain click toggles instead of opening. */
  selecting: boolean;
  onSelect: (event: { range: boolean }) => void;
};

const INTERACTIVE = "a, button, [role=menuitem], [data-slot=checkbox]";

const FRAME = "max-h-[84%] max-w-[84%] rounded-[3px] object-contain shadow-lg/20";

/** A frame of the project's media, framed on its background like the stage shows it. */
function StillFrame({ projectId, still }: { projectId: string; still: ProjectStill }): React.ReactElement {
  const src = projectFileUrl(projectId, still.file);
  if (still.kind === "video")
    return <video className={FRAME} muted playsInline preload="metadata" src={`${src}#t=${still.time}`} />;
  // biome-ignore lint/performance/noImgElement: a project file served by the studio, not a page asset
  return <img alt="" className={FRAME} draggable={false} loading="lazy" src={src} />;
}

export function ProjectCard({
  project,
  now,
  onRename,
  onDelete,
  onOpen,
  selected,
  selecting,
  onSelect,
  still,
}: ProjectCardProps): React.ReactElement {
  const href = `/projects/${project.id}`;

  /** Returns whether the click selected, so a link can cancel its own navigation. */
  const handleClick = (event: React.MouseEvent) => {
    const intent = projectClickIntent(event, selecting);
    if (intent === "open") return false;
    onSelect({ range: intent === "range" });
    return true;
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer select-none overflow-hidden transition-[box-shadow] hover:shadow-md/5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        selected && "ring-2 ring-info ring-offset-2 ring-offset-background has-[a:focus-visible]:ring-info"
      )}
      data-project-card={project.id}
      data-selected={selected ? "" : undefined}
      onAuxClick={(event) => {
        if (event.button !== 1 || (event.target instanceof Element && event.target.closest(INTERACTIVE)))
          return;
        window.open(href, "_blank", "noopener");
      }}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return;
        if (!handleClick(event)) onOpen();
      }}>
      <div className="relative aspect-[16/10] border-b bg-muted/72">
        <Checkbox
          aria-label={STUDIO_COPY.projects.selectProject(project.name)}
          checked={selected}
          className={cn(
            "absolute start-3 top-3 z-10 transition-opacity [&_[data-slot=checkbox-indicator]]:bg-info! [&_[data-slot=checkbox-indicator]]:text-white",
            selecting || selected
              ? "opacity-100"
              : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
          )}
          onClick={(event) => {
            event.preventDefault();
            onSelect({ range: event.shiftKey });
          }}
        />
        {/* Absolute, so the frame's height is a share of the card's and never grows with a tall still. */}
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex h-[64%] items-center justify-center overflow-hidden rounded-sm shadow-md/10 ring-1 ring-foreground/8"
            style={{ aspectRatio: cssAspectRatio(project.aspectRatio), background: project.background }}>
            {still ? <StillFrame projectId={project.id} still={still} /> : null}
          </div>
        </div>
      </div>
      <div className="flex items-start gap-2 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            aria-selected={selected}
            className="truncate font-medium text-foreground outline-none"
            draggable={false}
            href={href}
            onClick={(event) => {
              // Modifier clicks on the title select too; the browser's ⌥-download and ⇧-window never apply.
              if (handleClick(event) || event.altKey) event.preventDefault();
              if (event.altKey && !selecting) onOpen();
            }}>
            {project.name}
          </Link>
          <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <time dateTime={project.updatedAt} suppressHydrationWarning>
              {STUDIO_COPY.projects.updated(formatRelativeTime(project.updatedAt, now))}
            </time>
            <span aria-hidden="true">·</span>
            <span>{STUDIO_COPY.projects.clips(project.sceneCount)}</span>
          </p>
        </div>
        <Badge className="tabular-nums" variant="secondary">
          {project.aspectRatio}
        </Badge>
        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={STUDIO_COPY.projects.actions}
                className="-me-1.5 -mt-1"
                size="icon-xs"
                variant="ghost"
              />
            }>
            <EllipsisIcon aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={() => window.open(href, "_blank", "noopener")}>
              <ExternalLinkIcon aria-hidden="true" />
              {STUDIO_COPY.projects.openInNewTab}
            </MenuItem>
            <MenuItem onClick={onRename}>
              <PencilIcon aria-hidden="true" />
              {STUDIO_COPY.projects.rename}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={onDelete} variant="destructive">
              <Trash2Icon aria-hidden="true" />
              {STUDIO_COPY.projects.delete}
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
    </Card>
  );
}
