"use client";

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
import { FolderIcon, PlusIcon } from "@coss/ui/icons";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useState } from "react";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { createProjectAction, deleteProjectAction, renameProjectAction } from "./project-actions";
import { ProjectCard } from "./project-card";
import { ProjectNameDialog } from "./project-name-dialog";
import { STUDIO_COPY } from "@/modules/studio-copy";
import { AppThemeToggle } from "@/modules/theme/app-theme-toggle";

const copy = STUDIO_COPY.projects;

function toastError(error: unknown): void {
  toastManager.add({ type: "error", title: error instanceof Error ? error.message : String(error) });
}

export function ProjectsView({ projects }: { projects: ProjectSummary[] }): React.ReactElement {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState<ProjectSummary | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const newProjectButton = (
    <Button onClick={() => setCreateOpen(true)}>
      <PlusIcon aria-hidden="true" />
      {copy.newProject}
    </Button>
  );

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-2xl text-foreground leading-tight">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">{copy.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <AppThemeToggle />
          {projects.length > 0 ? newProjectButton : null}
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
                project={project}
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
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        projectName={target?.name ?? ""}
      />
    </main>
  );
}
