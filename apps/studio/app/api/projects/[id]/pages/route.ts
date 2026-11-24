import { studioProjectPages, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type PagesRouteContext = { params: Promise<{ id: string }> };

/** The app's pages, crawled at most every half hour; returns `{ pages }`. */
export async function GET(_request: Request, { params }: PagesRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  try {
    return Response.json({ pages: await studioProjectPages(project) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Couldn’t open the app: ${message}` }, { status: 502 });
  }
}
