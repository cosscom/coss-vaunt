"use client";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@coss/ui/components/alert-dialog";
import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@coss/ui/components/dialog";
import { Field, FieldLabel } from "@coss/ui/components/field";
import { Form } from "@coss/ui/components/form";
import { Input } from "@coss/ui/components/input";
import type * as React from "react";
import { useState } from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

const copy = STUDIO_COPY.timeline;
const MAX_TRACK_NAME = 40;

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function RenameTrackDialog({
  open,
  onOpenChange,
  name,
  onSubmit,
}: DialogProps & { name: string; onSubmit: (name: string) => void }): React.ReactElement {
  const [draft, setDraft] = useState(name);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(name);
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.renameTrack}</DialogTitle>
        </DialogHeader>
        <Form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) onSubmit(draft.trim());
          }}>
          <DialogPanel>
            <Field>
              <FieldLabel>{copy.trackName}</FieldLabel>
              <Input
                autoFocus
                maxLength={MAX_TRACK_NAME}
                onChange={(event) => setDraft(event.target.value)}
                value={draft}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>{copy.cancel}</DialogClose>
            <Button disabled={!draft.trim()} type="submit">
              {copy.save}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}

export function DeleteTrackDialog({
  open,
  onOpenChange,
  name,
  clipCount,
  onConfirm,
}: DialogProps & { name: string; clipCount: number; onConfirm: () => void }): React.ReactElement {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.deleteTrackTitle(name)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.deleteTrackDescription(clipCount)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>{copy.cancel}</AlertDialogClose>
          <Button onClick={onConfirm} variant="destructive">
            {copy.menu.deleteTrack}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
