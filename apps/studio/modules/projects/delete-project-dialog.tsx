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
import type * as React from "react";
import { useState } from "react";
import { STUDIO_COPY } from "@/modules/studio-copy";

type DeleteProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => Promise<void>;
};

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
}: DeleteProjectDialogProps): React.ReactElement {
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{STUDIO_COPY.projects.deleteTitle(projectName)}</AlertDialogTitle>
          <AlertDialogDescription>{STUDIO_COPY.projects.deleteDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>
            {STUDIO_COPY.projects.cancel}
          </AlertDialogClose>
          <Button
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
              } finally {
                setPending(false);
              }
            }}
            variant="destructive">
            {STUDIO_COPY.projects.deleteConfirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
