import path from "node:path";
import { listProjectAssets } from "@calcom/product-video/project-store/project-assets";
import { scanProjectAssets } from "@calcom/product-video/project-store/scan-project-assets";
import { STUDIO_ROOT, studioProjectStore } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

type AssetsRouteContext = { params: Promise<{ id: string }> };

/** Recordings with their takes, imported files and text clips; thumbnails come from the file route. */
export async function GET(_request: Request, { params }: AssetsRouteContext): Promise<Response> {
  const { id } = await params;
  const project = await studioProjectStore.get(id);
  if (!project) return new Response("Not found", { status: 404 });
  const scan = await scanProjectAssets(path.join(STUDIO_ROOT, project.id));
  return Response.json(listProjectAssets(project, scan), { headers: { "Cache-Control": "no-store" } });
}
