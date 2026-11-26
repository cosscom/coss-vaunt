import { type FfmpegInstallEvent, followFfmpegInstall } from "@coss/vaunt-engine/setup/ffmpeg-install";

export const dynamic = "force-dynamic";

/**
 * Downloads ffmpeg into vaunt's bin dir (~/.vaunt/bin), streaming server-sent events: `progress`… `extracting`,
 * `verifying`, then `done` or `error`. A second request while one runs joins it instead of downloading again;
 * when every request has gone away, the download is aborted and its partial files removed.
 */
export async function POST(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: FfmpegInstallEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "done" || event.type === "error") {
          closed = true;
          controller.close();
          // Finished: leaving can't abort anything now, so let go straight away.
          queueMicrotask(() => unsubscribe?.());
        }
      };
      unsubscribe = followFfmpegInstall(send);
    },
    cancel() {
      unsubscribe?.();
    },
  });
  request.signal.addEventListener("abort", () => unsubscribe?.());
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
  });
}
