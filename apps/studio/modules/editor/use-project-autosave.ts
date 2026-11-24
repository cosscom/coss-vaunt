"use client";

import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useEffect, useRef, useState } from "react";
import { saveProjectInOrder } from "./project-save-queue";

export type SaveStatus = "saved" | "saving" | "error";

export function useProjectAutosave(project: Project, delayMs = 500): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const lastSaved = useRef(project);

  useEffect(() => {
    if (project === lastSaved.current) return;
    setStatus("saving");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await saveProjectInOrder(project);
        lastSaved.current = project;
        if (!cancelled) setStatus("saved");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project, delayMs]);

  return status;
}
