import { type GenerationEvent, isGenerationEnd } from "@coss/vaunt-engine/ai/generation-events";
import { followGenerationJob } from "@coss/vaunt-engine/ai/generation-jobs";

export const dynamic = "force-dynamic";

type GenerationRouteContext = { params: Promise<{ id: string; jobId: string }> };

/** Server-sent events: each node's progress and clips, then `{ done: true }`. */
export async function GET(request: Request, { params }: GenerationRouteContext): Promise<Response> {
  const { id, jobId } = await params;
  const encoder = new TextEncoder();
  const subscription: { stop: (() => void) | null } = { stop: null };
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: GenerationEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (!isGenerationEnd(event)) return;
        closed = true;
        controller.close();
      };
      subscription.stop = followGenerationJob({ projectId: id, jobId }, send);
    },
    cancel() {
      subscription.stop?.();
    },
  });
  if (!subscription.stop) return Response.json({ error: "Generation not found" }, { status: 404 });
  request.signal.addEventListener("abort", () => subscription.stop?.());
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
  });
}
