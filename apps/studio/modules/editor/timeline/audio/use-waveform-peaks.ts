"use client";

import {
  parsePeaksFile,
  peaksFilePath,
  type WaveformPeaks,
} from "@calcom/product-video/audio/waveform-peaks";
import { useEffect, useState } from "react";
import { projectFileUrl } from "../../audio/project-file-url";

const cache = new Map<string, Promise<WaveformPeaks | null>>();

function loadPeaks(url: string): Promise<WaveformPeaks | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetch(url)
    .then((response) => (response.ok ? response.json() : null))
    .then(parsePeaksFile)
    .catch(() => null);
  cache.set(url, pending);
  return pending;
}

/** The waveform peaks written beside an imported audio file; null until they load or if they're missing. */
export function useWaveformPeaks(projectId: string, file: string): WaveformPeaks | null {
  const url = projectFileUrl(projectId, peaksFilePath(file));
  const [loaded, setLoaded] = useState<{ url: string; peaks: WaveformPeaks | null } | null>(null);
  useEffect(() => {
    let live = true;
    void loadPeaks(url).then((peaks) => {
      if (live) setLoaded({ url, peaks });
    });
    return () => {
      live = false;
    };
  }, [url]);
  return loaded?.url === url ? loaded.peaks : null;
}
