import { randomUUID } from "node:crypto";
import path from "node:path";
import { probeAudio } from "../imports/audio-probe";
import { audioClipFromProbe } from "../imports/audio-upload";
import { probeMedia } from "../imports/media-probe";
import { clipFromMedia, probeMatchesKind } from "../imports/media-upload";
import type { AssetTemplate, FileAsset, ProjectAssets } from "./project-assets";

async function probedTemplate(projectDir: string, asset: FileAsset): Promise<AssetTemplate | null> {
  const file = path.join(projectDir, asset.file);
  if (asset.kind === "audio") {
    const probe = await probeAudio(file).catch(() => null);
    if (!probe) return null;
    return {
      kind: "audio",
      clip: audioClipFromProbe({ id: randomUUID(), name: asset.name, file: asset.file, probe }),
    };
  }
  const probe = await probeMedia(file).catch(() => null);
  if (!probe || !probeMatchesKind(probe, asset.kind)) return null;
  return {
    kind: "video",
    clip: clipFromMedia({ id: randomUUID(), name: asset.name, file: asset.file, kind: asset.kind, probe }),
  };
}

/** Fills in the template of imported files no clip uses any more by probing them, so they can be dragged back in. */
export async function withImportTemplates(projectDir: string, assets: ProjectAssets): Promise<ProjectAssets> {
  const files = await Promise.all(
    assets.files.map(async (asset) =>
      asset.template ? asset : { ...asset, template: await probedTemplate(projectDir, asset) }
    )
  );
  return { ...assets, files };
}
