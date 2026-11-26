import { studioSettingsFile } from "@coss/vaunt-engine/settings/studio-settings";
import { STUDIO_ROOT } from "@/modules/projects/studio-project-store";

export const dynamic = "force-dynamic";

/** Where things are kept and which version is running, for Settings' General and About sections. */
export async function GET(): Promise<Response> {
  return Response.json({
    // Set by `vaunt start`; a development checkout has no release version.
    version: process.env.VAUNT_VERSION ?? null,
    projectsDir: STUDIO_ROOT,
    settingsFile: studioSettingsFile(),
  });
}
