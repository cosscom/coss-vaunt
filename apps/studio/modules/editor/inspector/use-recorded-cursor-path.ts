"use client";

import { createCursorTrack } from "@calcom/product-video/stage/cursor-track";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { useEffect, useState } from "react";
import { loadRecording, recordingTakesFor } from "../stage/frame-sources/recording-lookup";

/** Whether the take a recording clip shows has a cursor path; null until known or while it isn't recorded. */
export function useRecordedCursorPath(project: Project, clip: Clip): boolean | null {
  const takes = recordingTakesFor(project, clip);
  const key = takes?.key ?? null;
  const hashes = takes?.hashes.join(",") ?? "";
  const [result, setResult] = useState<{ key: string; hasPath: boolean } | null>(null);
  const filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;

  useEffect(() => {
    if (!key || !hashes) return;
    let cancelled = false;
    void loadRecording(filesUrl, clip.id, hashes.split(","))
      .then((recording) => {
        if (cancelled || !recording) return;
        const { cursor, fps } = recording.manifest;
        setResult({ key, hasPath: createCursorTrack(cursor, fps) !== null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [filesUrl, clip.id, key, hashes]);

  return result && result.key === key ? result.hasPath : null;
}
