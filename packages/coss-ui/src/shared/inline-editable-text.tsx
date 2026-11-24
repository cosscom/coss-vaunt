"use client";

import { Button } from "@coss/ui/components/button";
import { PencilIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useId, useRef, useState } from "react";

export type InlineEditableTextProps = Omit<React.ComponentProps<"input">, "onChange" | "size" | "value"> & {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isReady?: boolean;
};

export function InlineEditableText({
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  disabled = false,
  isReady = true,
  required = true,
  className,
  id,
  "aria-label": ariaLabel,
  name,
  ref,
  ...passThroughProps
}: InlineEditableTextProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const valueOnEditStartRef = useRef(value);
  const reactId = useId();
  const inputId = id ?? `inline-editable-text-${reactId}`;

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const startEditing = () => {
    if (disabled || isEditing) return;
    valueOnEditStartRef.current = value;
    setIsEditing(true);
  };

  const startEditingFromButton = () => {
    startEditing();
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  };

  const commitEditing = () => {
    setIsEditing(false);
  };

  const cancelEditing = () => {
    onChange(valueOnEditStartRef.current);
    setIsEditing(false);
  };

  const textClassName =
    "block max-w-full min-w-[1ch] truncate whitespace-pre bg-transparent font-[inherit] text-[length:inherit] leading-[inherit] tracking-[inherit]";

  return (
    <div
      className={cn(
        "pointer-events-auto relative inline-flex min-w-0 max-w-full items-center gap-1.5 not-data-disabled:cursor-text",
        "not-data-ready:**:data-[slot=inline-editable-text-edit]:pointer-events-none not-data-ready:**:data-[slot=inline-editable-text-edit]:invisible",
        className
      )}
      data-slot="inline-editable-text"
      data-editing={isEditing ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-ready={isReady ? "" : undefined}>
      <div
        className="relative min-w-0 max-w-full transition-colors in-data-editing:bg-muted in-[[data-slot=inline-editable-text]:not([data-disabled]):not([data-editing])]:hover:bg-muted"
        data-slot="inline-editable-text-field">
        <span
          aria-hidden="true"
          className={cn(textClassName, "pointer-events-none opacity-0")}
          data-slot="inline-editable-text-sizer">
          {value || "\u00A0"}
        </span>

        <input
          {...passThroughProps}
          ref={setRefs}
          id={inputId}
          name={name}
          type="text"
          value={value}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
          readOnly={!isEditing && !disabled}
          data-slot="inline-editable-text-input"
          className={cn(
            textClassName,
            "absolute inset-0 w-full p-0 text-current shadow-none outline-none ring-0",
            "cursor-text in-data-disabled:cursor-default"
          )}
          onClick={startEditing}
          onFocus={(event) => {
            startEditing();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            commitEditing();
            onBlur?.(event);
          }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitEditing();
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
              event.currentTarget.blur();
            }
            onKeyDown?.(event);
          }}
        />
      </div>

      {!disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          tabIndex={-1}
          aria-hidden="true"
          disabled={!isReady}
          data-slot="inline-editable-text-edit"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={startEditingFromButton}>
          <PencilIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
