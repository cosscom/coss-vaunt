"use client";

import type { Project } from "@calcom/product-video/storyboard/storyboard-schema";
import { activeClipsAt, projectDuration } from "@calcom/product-video/storyboard/track-resolution";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createStageRenderer } from "../editor/stage/stage-renderer";
import { textColorForBackground } from "../editor/stage/text/text-contrast";
import { TextOverlay } from "../editor/stage/text-overlay";
import { mixProjectAudio } from "./offline-audio-mix";
import { encodeWav } from "./wav-encoding";

/** What the exporter's headless browser calls, frame by frame. */
export type StudioRenderApi = {
  duration: number;
  /** Resolves once the frame for `time` is fully on screen: media loaded, stage drawn, text painted. */
  renderFrame: (time: number) => Promise<void>;
  /** The mixed soundtrack as a base64 WAV, or null without audio. */
  renderAudio: () => Promise<string | null>;
};

declare global {
  interface Window {
    __studioRender?: StudioRenderApi;
  }
}

const nextPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** The editor's composition at exactly the output size, drawn only when the exporter asks for a frame. */
export function RenderView({
  project,
  width,
  height,
}: {
  project: Project;
  width: number;
  height: number;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [time, setTime] = useState(0);
  const frame = { width, height };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createStageRenderer({ canvas, onInvalidate: () => undefined, forExport: true });
    renderer.setProject(project);
    renderer.setSize(width, height, 1);
    const duration = projectDuration(project);
    window.__studioRender = {
      duration,
      async renderFrame(next) {
        setTime(next);
        await renderer.prepare(next);
        renderer.render(next, false);
        await document.fonts.ready;
        await nextPaint();
      },
      async renderAudio() {
        const mixed = await mixProjectAudio(project, duration);
        return mixed ? toBase64(encodeWav(mixed)) : null;
      },
    };
    return () => {
      window.__studioRender = undefined;
      renderer.dispose();
    };
  }, [project, width, height]);

  const textClips = activeClipsAt(project, time).filter((entry) => entry.clip.source.kind === "text");
  return (
    <div className="fixed top-0 left-0 overflow-hidden" data-testid="render-frame" style={{ width, height }}>
      <canvas className="block" height={height} ref={canvasRef} style={{ width, height }} width={width} />
      <TextOverlay clips={textClips} color={textColorForBackground(project.settings)} frame={frame} />
    </div>
  );
}
