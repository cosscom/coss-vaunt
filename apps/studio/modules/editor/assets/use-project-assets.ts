"use client";

import type { ProjectAssets } from "@coss/vaunt-engine/project-store/project-assets";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useCallback, useEffect, useState } from "react";

/** Changes when a clip is added, removed or re-pinned, which is when the listing on disk can differ. */
function assetsRevision(project: Project): string {
  return [
    ...project.videoTracks.flatMap((track) =>
      track.clips.map(
        (clip) => `${clip.id}:${clip.source.kind === "recording" ? (clip.source.take ?? "") : ""}`
      )
    ),
    ...project.audioTracks.flatMap((track) => track.clips.map((clip) => clip.id)),
  ]
    .sort()
    .join(",");
}

/** The project's assets from the server, refetched while `active` whenever the clips change. */
export function useProjectAssets(
  project: Project,
  active: boolean
): { assets: ProjectAssets | null; failed: boolean; refresh: () => void } {
  const [assets, setAssets] = useState<ProjectAssets | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const revision = assetsRevision(project);
  const projectId = project.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision and nonce are refetch triggers.
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.statusText);
        setAssets((await response.json()) as ProjectAssets);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [projectId, active, revision, nonce]);

  useEffect(() => {
    if (!active) return;
    const onFocus = () => setNonce((value) => value + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [active]);

  return { assets, failed, refresh: useCallback(() => setNonce((value) => value + 1), []) };
}
