"use client";

import { frameFileName } from "@coss/vaunt-engine/recording/recording-manifest";
import type { Clip, Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useEffect, useState } from "react";
import { loadRecording, recordingTakesFor } from "../stage/frame-sources/recording-lookup";

export type ClipStill = { kind: "image" | "video"; url: string; aspect: number | null };

const fileUrl = (filesUrl: string, file: string) =>
  `${filesUrl}/${file.split("/").map(encodeURIComponent).join("/")}`;

/** A still of the clip's media to pick a point on: a recording's middle frame, an image, or an imported video. */
export function useClipStill(project: Project, clip: Clip): ClipStill | null {
  const filesUrl = `/api/projects/${encodeURIComponent(project.id)}/files`;
  const takes = recordingTakesFor(project, clip);
  const hashes = takes?.hashes.join(",") ?? "";
  const [recorded, setRecorded] = useState<{ key: string; still: ClipStill } | null>(null);
  const key = `${clip.id}:${takes?.key ?? null}`;

  useEffect(() => {
    if (!hashes) return;
    let cancelled = false;
    void loadRecording(filesUrl, clip.id, hashes.split(","))
      .then((recording) => {
        if (cancelled || !recording) return;
        const { manifest, directoryUrl } = recording;
        const middle = Math.floor(manifest.frameCount / 2);
        const url = manifest.proxy
          ? `${directoryUrl}/proxy/${frameFileName(middle, "webp")}`
          : `${directoryUrl}/frames/${frameFileName(middle, "png")}`;
        setRecorded({
          key,
          still: { kind: "image", url, aspect: manifest.viewport.width / manifest.viewport.height },
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [filesUrl, clip.id, key, hashes]);

  const { source } = clip;
  if (source.kind === "image") return { kind: "image", url: fileUrl(filesUrl, source.file), aspect: null };
  if (source.kind === "import") return { kind: "video", url: fileUrl(filesUrl, source.file), aspect: null };
  return recorded?.key === key ? recorded.still : null;
}
