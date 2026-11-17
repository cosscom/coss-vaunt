"use client";

import {
  type AssetTake,
  type AssetTemplate,
  type FileAsset,
  type ProjectAssets,
  pinnedTakeFor,
  type RecordingAsset,
} from "@calcom/product-video/project-store/project-assets";
import { Badge } from "@coss/ui/components/badge";
import { CaptionsIcon, MusicIcon, VideoIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { InspectorSection } from "../inspector/inspector-section";
import { formatTimecode } from "../timeline/format-timecode";
import type { EditorState } from "../use-editor-state";
import { ASSET_DRAG_TYPE, serializeAssetDrag } from "./asset-drag";
import { AssetPreviewCard, type PreviewMedia } from "./asset-preview-card";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.assets;

export function projectFileUrl(projectId: string, file: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/files/${file.split("/").map(encodeURIComponent).join("/")}`;
}

function dragProps(
  template: AssetTemplate | null
): React.HTMLAttributes<HTMLElement> & { draggable?: boolean } {
  if (!template) return {};
  return {
    draggable: true,
    onDragStart: (event) => {
      event.dataTransfer.setData(ASSET_DRAG_TYPE, serializeAssetDrag(template));
      event.dataTransfer.effectAllowed = "copy";
    },
  };
}

function Thumbnail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex aspect-video w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground *:size-full *:object-cover [&>svg]:size-4 [&>svg]:object-none",
        className
      )}>
      {children}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <InspectorSection aside={count} bodyClassName="gap-1 px-2 pt-0 pb-3" title={title}>
      {children}
    </InspectorSection>
  );
}

function takeMedia(take: AssetTake, projectId: string): PreviewMedia | null {
  const still = take.thumbnail ? projectFileUrl(projectId, take.thumbnail) : null;
  if (take.preview?.kind === "video")
    return { kind: "video", src: projectFileUrl(projectId, take.preview.file), still };
  if (take.preview?.kind === "frames" && take.frameCount > 0)
    return {
      kind: "frames",
      folderUrl: projectFileUrl(projectId, take.preview.folder),
      fps: take.fps,
      frameCount: take.frameCount,
      still,
    };
  return null;
}

const ROW =
  "flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-start outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring";

function TakeRow({
  take,
  index,
  clipName,
  projectId,
  onUse,
}: {
  take: AssetTake;
  index: number;
  clipName: string;
  projectId: string;
  onUse: (() => void) | null;
}): React.ReactElement {
  const body = (
    <>
      <Thumbnail>
        {take.thumbnail ? (
          <img alt="" src={projectFileUrl(projectId, take.thumbnail)} />
        ) : (
          <VideoIcon aria-hidden="true" />
        )}
      </Thumbnail>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-foreground text-sm">{copy.take(index)}</span>
        <span className="truncate text-muted-foreground text-xs tabular-nums">
          {take.frameCount > 0
            ? `${formatTimecode(take.frameCount / take.fps)}${take.theme ? ` · ${STUDIO_COPY.editor[take.theme]}` : ""}`
            : copy.unfinished}
        </span>
      </span>
      {take.active ? (
        <Badge size="sm" variant="secondary">
          {copy.showing}
        </Badge>
      ) : null}
    </>
  );
  const row =
    onUse && !take.active && take.thumbnail ? (
      <button
        aria-label={`${copy.useTake}: ${copy.take(index)}`}
        className={ROW}
        onClick={onUse}
        type="button">
        {body}
      </button>
    ) : (
      <div className={ROW}>{body}</div>
    );
  const media = takeMedia(take, projectId);
  if (!media) return row;
  return (
    <AssetPreviewCard
      media={media}
      seconds={take.frameCount / take.fps}
      title={`${clipName} · ${copy.take(index)}`}
      trigger={row}
    />
  );
}

function RecordingGroup({
  group,
  projectId,
  editor,
}: {
  group: RecordingAsset;
  projectId: string;
  editor: EditorState;
}): React.ReactElement {
  const clip = group.name === null ? null : group.clipId;
  const total = group.takes.length;
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-2 pt-1 text-muted-foreground text-xs">
        <span className={cn("truncate", group.name && "text-foreground")}>
          {group.name ?? copy.deletedClip}
        </span>
        <span className="shrink-0 tabular-nums">{copy.takes(total)}</span>
      </div>
      {group.takes.map((take, index) => (
        <TakeRow
          clipName={group.name ?? copy.deletedClip}
          index={total - index}
          key={take.hash}
          onUse={
            clip
              ? () => {
                  const current = editor.project.videoTracks
                    .flatMap((track) => track.clips)
                    .find((candidate) => candidate.id === clip);
                  if (current) editor.setClipTake(clip, pinnedTakeFor(editor.project, current, take.hash));
                }
              : null
          }
          projectId={projectId}
          take={take}
        />
      ))}
    </div>
  );
}

function FileRow({ asset, projectId }: { asset: FileAsset; projectId: string }): React.ReactElement {
  const row = (
    <div
      className={cn(ROW, asset.template ? "cursor-grab active:cursor-grabbing" : "opacity-72")}
      title={asset.template ? copy.dragHint : copy.notDraggable}
      {...dragProps(asset.template)}>
      <Thumbnail>
        {asset.kind === "image" ? (
          <img alt="" src={projectFileUrl(projectId, asset.file)} />
        ) : asset.kind === "video" ? (
          <video
            muted
            playsInline
            preload="metadata"
            src={`${projectFileUrl(projectId, asset.file)}#t=0.1`}
          />
        ) : (
          <MusicIcon aria-hidden="true" />
        )}
      </Thumbnail>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-foreground text-sm">{asset.name}</span>
        <span className="truncate text-muted-foreground text-xs">{copy.fileKinds[asset.kind]}</span>
      </span>
    </div>
  );
  if (asset.kind !== "video") return row;
  const source = asset.template?.kind === "video" ? asset.template.clip.source : null;
  return (
    <AssetPreviewCard
      media={{ kind: "video", src: projectFileUrl(projectId, asset.file), still: null }}
      seconds={source?.kind === "import" ? source.fileDuration : null}
      title={asset.name}
      trigger={row}
    />
  );
}

export function AssetsPanel({
  assets,
  failed,
  editor,
}: {
  assets: ProjectAssets | null;
  failed: boolean;
  editor: EditorState;
}): React.ReactElement {
  const { project } = editor;
  if (failed && !assets) return <p className="p-4 text-destructive-foreground text-sm">{copy.loadFailed}</p>;
  if (!assets) return <div className="min-h-40" />;
  const empty = assets.recordings.length + assets.files.length + assets.texts.length === 0;
  if (empty) {
    return (
      <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
        <p className="font-medium text-foreground text-sm">{copy.emptyTitle}</p>
        <p className="text-muted-foreground text-xs">{copy.emptyDescription}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <Section count={assets.recordings.length} title={copy.recordings}>
        {assets.recordings.map((group) => (
          <RecordingGroup editor={editor} group={group} key={group.clipId} projectId={project.id} />
        ))}
      </Section>
      <Section count={assets.files.length} title={copy.files}>
        {assets.files.map((asset) => (
          <FileRow asset={asset} key={asset.file} projectId={project.id} />
        ))}
      </Section>
      <Section count={assets.texts.length} title={copy.texts}>
        {assets.texts.map((text) => (
          <div
            className={cn(ROW, "cursor-grab active:cursor-grabbing")}
            key={text.clipId}
            title={copy.dragHint}
            {...dragProps(text.template)}>
            <Thumbnail>
              <CaptionsIcon aria-hidden="true" />
            </Thumbnail>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-foreground text-sm">{text.text}</span>
              <span className="truncate text-muted-foreground text-xs">{text.name}</span>
            </span>
          </div>
        ))}
      </Section>
    </div>
  );
}
