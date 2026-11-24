"use client";

import { ScrollArea } from "@coss/ui/components/scroll-area";
import type { Clip } from "@coss/vaunt-engine/storyboard/storyboard-schema";
import type * as React from "react";
import { SelectedAudioClipInspector, useSelectedAudioClip } from "../audio/selected-audio-clip-inspector";
import { PanelHeader } from "../panel-header";
import type { PlaybackClock } from "../player/playback-clock";
import type { EditorState } from "../use-editor-state";
import { BlurSection } from "./blur-section";
import { ClipSection } from "./clip-section";
import { DriftSection } from "./drift-section";
import { ProjectSections } from "./project-sections";
import { PropertyGroupSection } from "./property-group-section";
import { SectionResetButton } from "./section-reset-button";
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
            <SourceSection clip={clip} onClipChange={onClipChange} project={editor.project} />
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              action={
                <SectionResetButton
                  label={copy.resetDevice}
                  onReset={() => editor.resetPropertyGroup(clip.id, "device")}
                />
              }
              group="device"
              title={copy.deviceGroup}
            />
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              action={
                <SectionResetButton
                  label={STUDIO_COPY.timeline.menu.resetCamera}
                  onReset={() => editor.resetCamera(clip.id)}
                />
              }
              group="camera"
              title={copy.camera}
            />
            {clip.source.kind === "text" ? null : <DriftSection clip={clip} editor={editor} />}
            {clip.source.kind === "text" ? null : (
              <BlurSection clip={clip} clock={clock} editor={editor} onEditingChange={onBlurEditingChange} />
            )}
            <PropertyGroupSection
              clip={clip}
              clock={clock}
              editor={editor}
              action={
                <SectionResetButton
                  label={copy.resetTransform}
                  onReset={() => editor.resetPropertyGroup(clip.id, "clip")}
                />
              }
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
