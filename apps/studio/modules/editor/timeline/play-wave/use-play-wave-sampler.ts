"use client";

import { peaksFilePath, type WaveformPeaks } from "@coss/vaunt-engine/audio/waveform-peaks";
import type { Project } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import { useEffect, useMemo, useState } from "react";
import { projectFileUrl } from "../../audio/project-file-url";
import { loadPeaks } from "../audio/use-waveform-peaks";
import { audioSampler, clipsSampler, type PlayWaveSampler, syntheticSampler } from "./play-wave-samplers";

/**
 * What the play button's waveform shows: the project's audio when any of it has peaks, otherwise its clips (cuts
 * and transitions), otherwise quiet noise.
 */
export function usePlayWaveSampler(project: Project, seed: number): PlayWaveSampler {
  const files = useMemo(
    () => [...new Set(project.audioTracks.flatMap((track) => track.clips.map((clip) => clip.file)))].sort(),
    [project.audioTracks]
  );
  const key = files.join("\n");
  const [peaks, setPeaks] = useState<ReadonlyMap<string, WaveformPeaks>>(new Map());

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the file list, not the array's identity
  useEffect(() => {
    let live = true;
    void Promise.all(
      files.map(async (file) => {
        const loaded = await loadPeaks(projectFileUrl(project.id, peaksFilePath(file)));
        return loaded ? ([file, loaded] as const) : null;
      })
    ).then((entries) => {
      if (live) setPeaks(new Map(entries.filter((entry) => entry !== null)));
    });
    return () => {
      live = false;
    };
  }, [project.id, key]);

  return useMemo(
    () => audioSampler(project, peaks) ?? clipsSampler(project, seed) ?? syntheticSampler(seed),
    [project, peaks, seed]
  );
}
