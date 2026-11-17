"use client";

import { formatCubicBezier, parseCubicBezier } from "@calcom/product-video/storyboard/keyframe-ease";
import type { CubicPoints } from "@calcom/product-video/storyboard/storyboard-schema";
import { Input } from "@coss/ui/components/input";
import type * as React from "react";
import { useId, useState } from "react";
import { EASING_COPY as copy } from "./easing-copy";

type CubicBezierInputProps = {
  /** Null for hold, which has no cubic to show. */
  value: CubicPoints | null;
  disabled: boolean;
  onCommit: (points: CubicPoints) => void;
};

/** Remount with a `key` of the shown value so the draft follows edits made elsewhere. */
export function CubicBezierInput({ value, disabled, onCommit }: CubicBezierInputProps): React.ReactElement {
  const shown = value ? formatCubicBezier(value) : "";
  const [draft, setDraft] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  const commit = () => {
    if (draft.trim() === shown) {
      setInvalid(false);
      return;
    }
    const parsed = parseCubicBezier(draft);
    setInvalid(parsed === null);
    if (!parsed) return;
    setDraft(formatCubicBezier(parsed));
    onCommit(parsed);
  };

  return (
    <div className="flex flex-col gap-1">
      <Input
        aria-describedby={invalid ? errorId : undefined}
        aria-invalid={invalid || undefined}
        aria-label={copy.input}
        className="tabular-nums sm:text-[0.8125rem]"
        disabled={disabled}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(shown);
            setInvalid(false);
          }
        }}
        placeholder="cubic-bezier(0.42, 0, 0.58, 1)"
        size="sm"
        spellCheck={false}
        value={draft}
      />
      {invalid ? (
        <p className="text-destructive-foreground text-xs" id={errorId}>
          {copy.invalid}
        </p>
      ) : null}
    </div>
  );
}
