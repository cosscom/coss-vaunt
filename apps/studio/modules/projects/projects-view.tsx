"use client";

import type { ProjectStill } from "@calcom/product-video/project-store/project-still";
import type { ProjectSummary } from "@calcom/product-video/project-store/project-store";
import { Button } from "@coss/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@coss/ui/components/empty";
import { toastManager } from "@coss/ui/components/toast";
import { FolderIcon, PlusIcon, Trash2Icon } from "@coss/ui/icons";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useEffect, useState } from "react";
import { DeleteProjectDialog } from "./delete-project-dialog";
import {
  createProjectAction,
  deleteProjectAction,
  deleteProjectsAction,
  renameProjectAction,
} from "./project-actions";
import { ProjectCard } from "./project-card";
import { ProjectNameDialog } from "./project-name-dialog";
import {
  type Box,
  EMPTY_PROJECT_SELECTION,
  idsInBox,
  type ProjectSelection,
  pruneProjectSelection,
  selectProject,
} from "./project-selection";
import { STUDIO_COPY } from "@/modules/studio-copy";
import { AppThemeToggle } from "@/modules/theme/app-theme-toggle";

const copy = STUDIO_COPY.projects;

function toastError(error: unknown): void {
  toastManager.add({ type: "error", title: error instanceof Error ? error.message : String(error) });
}

export function ProjectsView({
  projects,
  stills,
}: {
  projects: ProjectSummary[];
  stills: Record<string, ProjectStill | null>;
}): React.ReactElement {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<ProjectSummary | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rawSelection, setSelection] = useState<ProjectSelection>(EMPTY_PROJECT_SELECTION);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const order = projects.map((project) => project.id);
  const selection = pruneProjectSelection(rawSelection, order);
  const selectedCount = selection.ids.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, [contenteditable], [role=dialog]")
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && order.length > 0) {
        event.preventDefault();
        setSelection({ ids: order, anchor: order[0] ?? null });
      } else if (event.key === "Escape") {
        setSelection(EMPTY_PROJECT_SELECTION);
      } else if ((event.key === "Backspace" || event.key === "Delete") && selectedCount > 0) {
        event.preventDefault();
        setDeleteManyOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const [box, setBox] = useState<Box | null>(null);

  /** Dragging across empty space draws a selection box, like a file browser; a plain click there clears the selection. */
  const onBackgroundPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-project-card], header, button, a"))
      return;
    const origin = { x: event.clientX, y: event.clientY };
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const base = additive ? selection.ids : [];
    const cards = [...document.querySelectorAll<HTMLElement>("[data-project-card]")].map((element) => ({
      id: element.dataset.projectCard ?? "",
      rect: element.getBoundingClientRect(),
    }));
    let moved = false;
    const move = (pointer: PointerEvent) => {
      if (!moved && Math.hypot(pointer.clientX - origin.x, pointer.clientY - origin.y) < 4) return;
      moved = true;
      const next = {
        left: Math.min(origin.x, pointer.clientX),
        right: Math.max(origin.x, pointer.clientX),
        top: Math.min(origin.y, pointer.clientY),
        bottom: Math.max(origin.y, pointer.clientY),
      };
      setBox(next);
      const ids = [...new Set([...base, ...idsInBox(next, cards)])];
      setSelection({ ids, anchor: ids[0] ?? null });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBox(null);
      if (!moved && !additive) setSelection(EMPTY_PROJECT_SELECTION);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const newProjectButton = (
    <Button onClick={() => setCreateOpen(true)}>
      <PlusIcon aria-hidden="true" />
      {copy.newProject}
    </Button>
  );

  return (
    <main
      className="mx-auto flex min-h-full w-full max-w-6xl select-none flex-col gap-8 px-6 py-10"
      onPointerDown={onBackgroundPointerDown}>
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-md border border-info/48 bg-info/8"
          style={{ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }}
        />
      ) : null}
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl text-foreground leading-tight">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <>
              <span className="pe-1 text-muted-foreground text-sm tabular-nums">
                {copy.selected(selectedCount)}
              </span>
              {selectedCount < order.length ? (
                <Button
                  onClick={() => setSelection({ ids: order, anchor: order[0] ?? null })}
                  variant="ghost">
                  {copy.selectAll}
                </Button>
              ) : null}
              <Button onClick={() => setSelection(EMPTY_PROJECT_SELECTION)} variant="ghost">
                {copy.clearSelection}
              </Button>
              <Button onClick={() => setDeleteManyOpen(true)} variant="destructive-outline">
                <Trash2Icon aria-hidden="true" />
                {copy.deleteSelected}
              </Button>
            </>
          ) : (
            <>
              <AppThemeToggle />
              {projects.length > 0 ? newProjectButton : null}
            </>
          )}
        </div>
      </header>

      {projects.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed py-24">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
            <EmptyDescription>{copy.emptyDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{newProjectButton}</EmptyContent>
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard
                now={now}
                onDelete={() => {
                  setTarget(project);
                  setDeleteOpen(true);
                }}
                onRename={() => {
                  setTarget(project);
                  setRenameOpen(true);
                }}
                onOpen={() => router.push(`/projects/${project.id}`)}
                onSelect={({ range }) => setSelection(selectProject(selection, order, project.id, { range }))}
                project={project}
                selected={selection.ids.includes(project.id)}
                still={stills[project.id] ?? null}
                selecting={selectedCount > 0}
              />
            </li>
          ))}
        </ul>
      )}

      <ProjectNameDialog
        description={copy.newProjectDescription}
        initialName=""
        onOpenChange={setCreateOpen}
        onSubmit={async (name) => {
          try {
            const { id } = await createProjectAction(name);
            router.push(`/projects/${id}`);
          } catch (error) {
            toastError(error);
          }
        }}
        open={createOpen}
        submitLabel={copy.create}
        title={copy.newProject}
      />
      <ProjectNameDialog
        initialName={target?.name ?? ""}
        onOpenChange={setRenameOpen}
        onSubmit={async (name) => {
          if (!target) return;
          try {
            await renameProjectAction(target.id, name);
            setRenameOpen(false);
            router.refresh();
          } catch (error) {
            toastError(error);
          }
        }}
        open={renameOpen}
        submitLabel={copy.save}
        title={copy.renameTitle}
      />
      <DeleteProjectDialog
        onConfirm={async () => {
          if (!target) return;
          try {
            await deleteProjectAction(target.id);
            setDeleteOpen(false);
            router.refresh();
          } catch (error) {
            toastError(error);
          }
        }}
        confirmLabel={copy.deleteConfirm}
        description={copy.deleteDescription}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title={copy.deleteTitle(target?.name ?? "")}
      />
      <DeleteProjectDialog
        confirmLabel={copy.deleteManyConfirm(selectedCount)}
        description={copy.deleteManyDescription}
        onConfirm={async () => {
          try {
            await deleteProjectsAction(selection.ids);
            setDeleteManyOpen(false);
            setSelection(EMPTY_PROJECT_SELECTION);
            router.refresh();
          } catch (error) {
            toastError(error);
          }
        }}
        onOpenChange={setDeleteManyOpen}
        open={deleteManyOpen}
        title={copy.deleteManyTitle(selectedCount)}
      />
    </main>
  );
}
