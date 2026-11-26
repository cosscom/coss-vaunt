import { agentChatRequestSchema, streamAgentEvents } from "@coss/vaunt-engine/ai/agent-chat";
import { studioProjectPages, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type AgentRouteContext = { params: Promise<{ id: string }> };

/**
 * The agent's turn, streamed as newline-delimited JSON events (`AgentEvent`): its words, its questions, and the
 * boards and scenes it drafts. Body: `{ messages, context, board }`.
 */
export async function POST(request: Request, { params }: AgentRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = agentChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  // A board can be planned before the app is running; it just plans without the app's page list.
  const pages = await studioProjectPages(project).catch((error: unknown) => {
    console.warn("Couldn't crawl the app for its pages:", error instanceof Error ? error.message : error);
    return [];
  });
  const app = project.settings.app;
  const events = streamAgentEvents(
    parsed.data,
    { pages, appNotes: app?.kind === "web" ? app.instructions : "" },
    { abortSignal: request.signal }
  );
  const lines = events.pipeThrough(
    new TransformStream({
      transform: (event, controller) => controller.enqueue(`${JSON.stringify(event)}\n`),
    })
  );
  return new Response(lines.pipeThrough(new TextEncoderStream()), {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
