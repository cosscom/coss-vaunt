"use client";

import { Input } from "@coss/ui/components/input";
import { Textarea } from "@coss/ui/components/textarea";
import type * as React from "react";
import { useState } from "react";

type DraftTextFieldProps = {
  id: string;
  value: string;
  maxLength: number;
  onCommit: (value: string) => void;
  placeholder?: string;
  /** Empty drafts are allowed while typing; only values that pass reach the project. */
  allowEmpty?: boolean;
};

function useDraft({
  value,
  onCommit,
  allowEmpty,
}: Pick<DraftTextFieldProps, "value" | "onCommit" | "allowEmpty">) {
  const [draft, setDraft] = useState(value);
  return {
    value: draft,
    onBlur: () => setDraft(value),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(event.target.value);
      if (allowEmpty || event.target.value.trim()) onCommit(event.target.value);
    },
  };
}

/** Remount with a `key` per clip so the draft resets when the selection changes. */
export function DraftInput({
  id,
  maxLength,
  placeholder,
  ...draft
}: DraftTextFieldProps): React.ReactElement {
  return <Input id={id} maxLength={maxLength} placeholder={placeholder} size="sm" {...useDraft(draft)} />;
}

export function DraftTextarea({
  id,
  maxLength,
  placeholder,
  ...draft
}: DraftTextFieldProps): React.ReactElement {
  return (
    <Textarea
      className="min-h-16"
      id={id}
      maxLength={maxLength}
      placeholder={placeholder}
      size="sm"
      {...useDraft(draft)}
    />
  );
}
