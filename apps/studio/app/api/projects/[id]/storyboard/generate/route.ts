import path from "node:path";
import { generateBoardRequestSchema } from "@coss/vaunt-engine/ai/generation-events";
import { latestGenerationJob, startGenerationJob } from "@coss/vaunt-engine/ai/generation-jobs";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type GenerateRouteContext = { params: Promise<{ id: string }> };

/** The project's latest generation, so an editor opened during or after it can still apply its clips. */
export async function GET(_request: Request, { params }: GenerateRouteContext): Promise<Response> {
  const { id } = await params;
  const job = latestGenerationJob(id);
  if (!job) return Response.json({ error: "No generation" }, { status: 404 });
  return Response.json(job);
}

/** Starts generating clips for the board's nodes; follow it at `generate/<jobId>`. Body: `{ board, nodeIds? }`. */
export async function POST(request: Request, { params }: GenerateRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = generateBoardRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const job = startGenerationJob({
    repoRoot: path.dirname(STUDIO_ROOT),
    studioRoot: STUDIO_ROOT,
    projectId: project.id,
    request: parsed.data,
  });
  if (!job) return Response.json({ error: "This project is already generating" }, { status: 409 });
  return Response.json(job, { status: 202 });
}
