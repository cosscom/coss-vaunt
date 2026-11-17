"use client";

import { createCursorTrack } from "@calcom/product-video/stage/cursor-track";
import type { Clip, Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { useEffect, useState } from "react";
import { loadRecording, recordingHashFor } from "../stage/frame-sources/recording-lookup";

/** Whether the take a recording clip shows has a cursor path; null until known or while it isn't recorded. */
export function useRecordedCursorPath(project: Project, clip: Clip): boolean | null {
  const hash = recordingHashFor(project, clip);
  const [result, setResult] = useState<{ hash: string; hasPath: boolean } | null>(null);
  const filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;

  useEffect(() => {
    if (!hash) return;
    let cancelled = false;
    void loadRecording(filesUrl, clip.id, hash)
      .then((recording) => {
        if (cancelled || !recording) return;
        const { cursor, fps } = recording.manifest;
        setResult({ hash, hasPath: createCursorTrack(cursor, fps) !== null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [filesUrl, clip.id, hash]);

  return result && result.hash === hash ? result.hasPath : null;
}
