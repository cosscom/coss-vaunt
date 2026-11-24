"use client";

import { Alert, AlertDescription } from "@coss/ui/components/alert";
import { Button } from "@coss/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@coss/ui/components/empty";
import { CircleAlertIcon, UploadIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { ACCEPTED_MEDIA } from "@coss/vaunt-engine/imports/media-types";
import type { Clip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { useState } from "react";
import { mediaFilesFromDrop } from "../media/clipboard-media";
import { MEDIA_IMPORT_COPY as copy } from "../media/media-import-copy";
import { useMediaImport } from "../media/use-media-import";

export type MediaUploadPanelProps = {
  projectId: string;
  /** Called once all files are in, with the clips that imported. */
  onImported: (clips: Clip[]) => void;
};

/** A drop zone and file picker that upload videos and images into the project. */
export function MediaUploadPanel({ projectId, onImported }: MediaUploadPanelProps): React.ReactElement {
  const { importFiles, importing } = useMediaImport(projectId);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState(false);

  const upload = async (files: File[], offered: number) => {
    setRejected(offered > 0 && files.length === 0);
    if (files.length === 0) return;
    const clips = await importFiles(files);
    if (clips.length > 0) onImported(clips);
  };

  return (
    <div className="flex flex-col gap-3">
      <Empty
        className={cn(
          "rounded-xl border border-input border-dashed py-8 transition-colors",
          dragging && "border-ring bg-accent/50"
        )}
        data-testid="media-upload-drop-zone"
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!importing)
            void upload(mediaFilesFromDrop(event.dataTransfer), event.dataTransfer.files.length);
        }}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UploadIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{copy.dropTitle}</EmptyTitle>
          <EmptyDescription>{copy.dropDescription}</EmptyDescription>
        </EmptyHeader>
        <Button disabled={importing} loading={importing} render={<label />} size="sm" variant="outline">
          <input
            accept={ACCEPTED_MEDIA}
            className="sr-only"
            data-testid="media-upload-input"
            disabled={importing}
            multiple
            onChange={(event) => {
              const input = event.currentTarget;
              const files = Array.from(input.files ?? []);
              input.value = "";
              void upload(mediaFilesFromDrop({ files }), files.length);
            }}
            type="file"
          />
          {copy.choose}
        </Button>
      </Empty>
      {rejected ? (
        <Alert variant="error">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{copy.nothingToImport}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
