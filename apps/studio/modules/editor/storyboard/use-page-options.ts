"use client";

import type { DiscoveredPage } from "@calcom/product-video/discovery/page-discovery";
import { useEffect, useState } from "react";
import { type PageOption, pageOptionsFrom } from "./page-options";

/** The app's pages for suggesting a scene's path; empty until the crawl answers, or when it can't. */
export function usePageOptions(projectId: string): readonly PageOption[] {
  const [options, setOptions] = useState<readonly PageOption[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/projects/${encodeURIComponent(projectId)}/pages`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ pages: DiscoveredPage[] }>) : null))
      .then((body) => {
        if (body) setOptions(pageOptionsFrom(body.pages));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId]);
  return options;
}
