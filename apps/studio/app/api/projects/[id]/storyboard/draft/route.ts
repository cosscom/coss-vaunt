import path from "node:path";
import { BoardDraftError, draftBoard, draftBoardRequestSchema } from "@calcom/product-video/ai/board-draft";
import { loadAiKeys } from "@calcom/product-video/ai/studio-model";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type DraftRouteContext = { params: Promise<{ id: string }> };

/** Drafts a storyboard from a prompt. Body: `{ prompt, routes, totalSeconds, board? }`; returns `{ board }`. */
export async function POST(request: Request, { params }: DraftRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = draftBoardRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  await loadAiKeys(path.dirname(STUDIO_ROOT));
  try {
    return Response.json({ board: await draftBoard(parsed.data) });
  } catch (error) {
    if (error instanceof BoardDraftError) return Response.json({ error: error.message }, { status: 422 });
    console.error("Drafting a storyboard failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Drafting the board failed" }, { status: 502 });
  }
}
