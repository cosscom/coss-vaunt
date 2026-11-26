"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** `GET /api/setup/tools`: what's installed, and whether ffmpeg can be downloaded for this machine. */
export type ToolsStatus = {
  chromium: { ready: boolean };
  ffmpeg: {
    ready: boolean;
    source: "vaunt" | "system" | null;
    version: string | null;
    path: string | null;
    missingEncoders: string[];
    downloadBytes: number | null;
    installable: boolean;
  };
};

/** One event from `POST /api/setup/ffmpeg`'s stream. */
type InstallEvent =
  | { type: "progress"; received: number; total: number | null }
  | { type: "extracting" }
  | { type: "verifying" }
  | { type: "done"; version: string; path: string }
  | { type: "error"; message: string };

export type FfmpegInstall =
  | { phase: "idle" }
  | { phase: "downloading"; received: number; total: number | null }
  | { phase: "verifying" }
  | { phase: "error"; message: string };

const OFFLINE = "Couldn't reach the studio. Check it's still running, then try again.";

/**
 * The setup slide's state: the tools' status from the studio, and an ffmpeg install streamed from it. The status is
 * checked again whenever the window regains focus, so an ffmpeg installed with Homebrew in a terminal shows up as
 * soon as you come back.
 */
export function useSetupTools(): {
  status: ToolsStatus | null;
  install: FfmpegInstall;
  startInstall: () => void;
} {
  const [status, setStatus] = useState<ToolsStatus | null>(null);
  const [install, setInstall] = useState<FfmpegInstall>({ phase: "idle" });
  const running = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/setup/tools", { cache: "no-store" });
      if (response.ok) {
        setStatus((await response.json()) as ToolsStatus);
        return true;
      }
    } catch {
      // Keep the last status; the next try (below, or the next focus) may reach it.
    }
    return false;
  }, []);

  useEffect(() => {
    // Until the first answer arrives (the studio may still be compiling), try again every couple of seconds.
    let retry = 0;
    const first = async () => {
      if (!(await refresh())) retry = window.setTimeout(first, 2000);
    };
    void first();
    const onFocus = () => {
      if (!running.current) void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearTimeout(retry);
      running.current?.abort();
    };
  }, [refresh]);

  const startInstall = useCallback(() => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setInstall({ phase: "downloading", received: 0, total: status?.ffmpeg.downloadBytes ?? null });

    const handle = (event: InstallEvent) => {
      if (event.type === "progress")
        setInstall({ phase: "downloading", received: event.received, total: event.total });
      else if (event.type === "extracting" || event.type === "verifying") setInstall({ phase: "verifying" });
      else if (event.type === "error") setInstall({ phase: "error", message: event.message });
      else if (event.type === "done") {
        setInstall({ phase: "idle" });
        void refresh();
      }
    };

    void (async () => {
      try {
        const response = await fetch("/api/setup/ffmpeg", { method: "POST", signal: controller.signal });
        if (!response.ok || !response.body) throw new Error(OFFLINE);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        let finished = false;
        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          // Server-sent events: blank-line separated, one JSON object per `data:` line.
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            for (const line of block.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const event = JSON.parse(line.slice(5).trim()) as InstallEvent;
              handle(event);
              if (event.type === "done" || event.type === "error") finished = true;
            }
          }
        }
        if (!finished) handle({ type: "error", message: OFFLINE });
      } catch {
        if (!controller.signal.aborted) handle({ type: "error", message: OFFLINE });
      } finally {
        running.current = null;
      }
    })();
  }, [refresh, status?.ffmpeg.downloadBytes]);

  return { status, install, startInstall };
}
