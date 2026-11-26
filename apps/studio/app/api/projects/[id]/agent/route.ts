import { agentChatRequestSchema, streamAgentReply } from "@coss/vaunt-engine/ai/agent-chat";
import { MissingApiKeyError } from "@coss/vaunt-engine/ai/studio-model";
import { studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type AgentRouteContext = { params: Promise<{ id: string }> };

/** The agent's reply to the conversation, streamed as plain text. Body: `{ messages, context }`. */
export async function POST(request: Request, { params }: AgentRouteContext): Promise<Response> {
  const { id } = await params;
  if (!(await studioProjectStore.get(id)))
    return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = agentChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const reply = await streamAgentReply(parsed.data, { abortSignal: request.signal });
    return new Response(reply.pipeThrough(new TextEncoderStream()), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) return Response.json({ error: error.message }, { status: 422 });
    console.error("The agent couldn't reply:", error instanceof Error ? error.message : error);
    return Response.json({ error: "The agent couldn't reply" }, { status: 502 });
  }
}
