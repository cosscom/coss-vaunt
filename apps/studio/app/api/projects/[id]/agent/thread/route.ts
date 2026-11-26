import path from "node:path";
import { agentThreadSchema } from "@coss/vaunt-engine/ai/agent-thread";
import { readAgentThread, writeAgentThread } from "@coss/vaunt-engine/project-store/agent-thread-store";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type ThreadRouteContext = { params: Promise<{ id: string }> };

async function projectDir(id: string): Promise<string | null> {
  const project = await studioProjectStore.get(id);
  return project ? path.join(STUDIO_ROOT, project.id) : null;
}

/** The project's conversation with the agent, kept in `agent-thread.json` beside the project. */
export async function GET(_request: Request, { params }: ThreadRouteContext): Promise<Response> {
  const dir = await projectDir((await params).id);
  if (!dir) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json(
    { messages: await readAgentThread(dir) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Replaces the saved conversation, after each turn and each undo. Body: `{ messages }`. */
export async function PUT(request: Request, { params }: ThreadRouteContext): Promise<Response> {
  const dir = await projectDir((await params).id);
  if (!dir) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = agentThreadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  return Response.json({ messages: await writeAgentThread(dir, parsed.data.messages) });
}
