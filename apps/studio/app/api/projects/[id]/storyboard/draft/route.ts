import { BoardDraftError, draftBoard, draftBoardRequestSchema } from "@coss/vaunt-engine/ai/board-draft";
import { MissingApiKeyError } from "@coss/vaunt-engine/ai/studio-model";
import { studioProjectPages, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type DraftRouteContext = { params: Promise<{ id: string }> };

/** Drafts a storyboard from a prompt. Body: `{ prompt, totalSeconds, board? }`; returns `{ board }`. */
export async function POST(request: Request, { params }: DraftRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  const parsed = draftBoardRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  // A board can be planned before the app is running; it just plans without the app's page list.
  const pages = await studioProjectPages(project).catch((error: unknown) => {
    console.warn("Couldn't crawl the app for its pages:", error instanceof Error ? error.message : error);
    return [];
  });
  const app = project.settings.app;
  try {
    const board = await draftBoard({
      ...parsed.data,
      pages,
      appNotes: app?.kind === "web" ? app.instructions : "",
    });
    return Response.json({ board });
  } catch (error) {
    if (error instanceof BoardDraftError || error instanceof MissingApiKeyError)
      return Response.json({ error: error.message }, { status: 422 });
    console.error("Drafting a storyboard failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Drafting the board failed" }, { status: 502 });
  }
}
