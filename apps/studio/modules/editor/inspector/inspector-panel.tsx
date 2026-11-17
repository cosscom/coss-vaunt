"use client";

import type { Clip } from "@calcom/product-video/storyboard/storyboard-schema";
import { ScrollArea } from "@coss/ui/components/scroll-area";
import type * as React from "react";
import { SelectedAudioClipInspector, useSelectedAudioClip } from "../audio/selected-audio-clip-inspector";
import { PanelHeader } from "../panel-header";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { BlurSection } from "./blur-section";
import { ClipSection } from "./clip-section";
import { DraftInput } from "./draft-text-field";
import { InspectorRow } from "./inspector-row";
import { ProjectSections } from "./project-sections";
import { PropertyGroupSection } from "./property-group-section";
import { SourceSection } from "./source-section";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.inspector;

export function InspectorPanel({
  editor,
  clock,
  onBlurEditingChange,
}: {
  editor: EditorState;
  clock: PlaybackClock;
  onBlurEditingChange: (editing: boolean) => void;
}): React.ReactElement {
  const clip = editor.primaryClip;
  const audioClip = useSelectedAudioClip(editor, clock);
  const onClipChange = (update: (clip: Clip) => Clip) => clip && editor.editClip(clip.id, update);
  const selectedCount = editor.selection.clipIds.length;

  return (
    <aside aria-label={copy.title} className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={clip || audioClip ? copy.title : copy.projectTitle}>
        {selectedCount > 1 ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {copy.selectedCount(selectedCount)}
          </span>
        ) : null}
      </PanelHeader>
      <ScrollArea className="flex-1" scrollFade>
        {clip ? (
          <>
            <ClipSection
              clip={clip}
              focusTransition={editor.focusTransition}
              key={clip.id}
              onEdit={editor.edit}
              project={editor.project}
            />
            <SourceSection clip={clip} onClipChange={onClipChange} projectId={editor.project.id} />
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              group="device"
              title={copy.deviceGroup}
            />
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              group="camera"
              title={copy.camera}>
              {clip.source.kind === "recording" ? (
                <InspectorRow htmlFor="clip-focus" label={copy.focus}>
                  <DraftInput
                    allowEmpty
                    id="clip-focus"
                    key={clip.id}
                    maxLength={200}
                    onCommit={(focus) =>
                      onClipChange((current) => ({
                        ...current,
                        focus: focus.trim() ? focus.trim() : undefined,
                      }))
                    }
                    placeholder={copy.focusPlaceholder}
                    value={clip.focus ?? ""}
                  />
                </InspectorRow>
              ) : null}
            </PropertyGroupSection>
            {clip.source.kind === "text" ? null : (
              <BlurSection clip={clip} clock={clock} editor={editor} onEditingChange={onBlurEditingChange} />
            )}
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              group="clip"
              title={copy.clipGroup}
            />
          </>
        ) : audioClip ? (
          <SelectedAudioClipInspector clip={audioClip} clock={clock} editor={editor} />
        ) : (
          <>
            <p className="border-b px-4 py-3 text-muted-foreground text-xs">{copy.emptyDescription}</p>
            <ProjectSections
              onSettingsChange={(settings) => editor.updateSettings(settings, "settings")}
              settings={editor.project.settings}
            />
          </>
        )}
      </ScrollArea>
    </aside>
  );
}
