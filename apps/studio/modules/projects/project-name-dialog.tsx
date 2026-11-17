"use client";

import { Button } from "@coss/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
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

type ProjectNameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName: string;
  onSubmit: (name: string) => Promise<void>;
};

export function ProjectNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName,
  onSubmit,
}: ProjectNameDialogProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initialName);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Form
          className="contents"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            try {
              await onSubmit(name.trim());
            } finally {
              setPending(false);
            }
          }}>
          <DialogPanel>
            <Field>
              <FieldLabel>{STUDIO_COPY.projects.nameLabel}</FieldLabel>
              <Input
                autoFocus
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                placeholder={STUDIO_COPY.projects.namePlaceholder}
                required
                value={name}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>{STUDIO_COPY.projects.cancel}</DialogClose>
            <Button disabled={!name.trim()} loading={pending} type="submit">
              {submitLabel}
            </Button>
          </DialogFooter>
        </Form>
      </DialogPopup>
    </Dialog>
  );
}
