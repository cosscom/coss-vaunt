"use client";

import type { ProjectSummary } from "@calcom/product-video/project-store/project-store";
import { Badge } from "@coss/ui/components/badge";
import { Button } from "@coss/ui/components/button";
import { Card } from "@coss/ui/components/card";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@coss/ui/components/menu";
import { EllipsisIcon, PencilIcon, Trash2Icon } from "@coss/ui/icons";
import Link from "next/link";
import type * as React from "react";
import { cssAspectRatio } from "./css-aspect-ratio";
import { formatRelativeTime } from "./relative-time";
import { STUDIO_COPY } from "@/modules/studio-copy";

type ProjectCardProps = {
  project: ProjectSummary;
  now: Date;
  onRename: () => void;
  onDelete: () => void;
};

export function ProjectCard({ project, now, onRename, onDelete }: ProjectCardProps): React.ReactElement {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md/5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring">
      <div className="flex aspect-[16/10] items-center justify-center border-b bg-muted/72">
        <div
          aria-hidden="true"
          className="h-[64%] rounded-sm shadow-md/10 ring-1 ring-foreground/8"
          style={{ aspectRatio: cssAspectRatio(project.aspectRatio), background: project.background }}
        />
      </div>
      <div className="flex items-start gap-2 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            className="truncate font-medium text-foreground outline-none after:absolute after:inset-0"
            href={`/projects/${project.id}`}>
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
        <Badge className="relative tabular-nums" variant="outline">
          {project.aspectRatio}
        </Badge>
        <Menu>
          <MenuTrigger
            render={
              <Button
                aria-label={STUDIO_COPY.projects.actions}
                className="relative -me-1.5 -mt-1"
                size="icon-xs"
                variant="ghost"
              />
            }>
            <EllipsisIcon aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup align="end">
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
