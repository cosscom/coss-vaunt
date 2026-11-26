"use client";

import { Button } from "@coss/ui/components/button";
import type { ComposerProps } from "@coss/ui/components/composer";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  getComposerText,
} from "@coss/ui/components/composer";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@coss/ui/components/tooltip";
import { ArrowUpIcon, CornerDownRightIcon, XIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import type { Context, CSSProperties, HTMLAttributes, ReactNode, RefObject } from "react";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { AgentIconAction } from "./agent-icon-action";
import { getAgentComposerInput } from "./composer-focus";
import { PointerGlowOverlay, usePointerGlow } from "./pointer-glow";

type AgentComposerContextValue = {
  composerProps?: ComposerProps;
  layout?: ComposerProps["layout"];
  allowSubmitWhileBusy: boolean;
  autoFocus: boolean;
  autoComplete: string;
  disabled: boolean;
  inputLabel: string;
  isBusy: boolean;
  name?: string;
  onStop: () => void;
  onSubmit: () => void;
  onValueChange?: (value: string) => void;
  placeholder: string;
  rows: number;
  sendLabel: string;
  stopLabel: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
};

type AgentComposerRootProps = {
  composerProps?: ComposerProps;
  layout?: ComposerProps["layout"];
  inputRef?: RefObject<HTMLElement | null>;
  allowSubmitWhileBusy?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  inputLabel: string;
  isBusy?: boolean;
  name?: string;
  onStop: () => void;
  onSubmit: () => void;
  onValueChange?: (value: string) => void;
  placeholder: string;
  rows?: number;
  sendLabel: string;
  stopLabel: string;
  value: string;
};

type AgentComposerFrameProps = {
  children: ReactNode;
  className?: string;
  headerOpen?: boolean;
  withFooter?: boolean;
  withHeader?: boolean;
};

type AgentComposerInputProps = {
  children: ReactNode;
  className?: string;
  withFooter?: boolean;
  withHeader?: boolean;
};

type AgentComposerTextareaProps = {
  className?: string;
};

type AgentComposerActionsProps = {
  children: ReactNode;
  className?: string;
};

type AgentComposerSlotProps = {
  children?: ReactNode;
  className?: string;
};

type AgentComposerFooterProps = {
  children: ReactNode;
  className?: string;
};

type AgentComposerHintProps = {
  children: ReactNode;
  className?: string;
};

type AgentComposerProps = Omit<AgentComposerRootProps, "onValueChange"> & {
  input?: ReactNode;
  actionRowClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  frameClassName?: string;
  header?: ReactNode;
  headerClassName?: string;
  headerOpen?: boolean;
  hint?: string;
  hintClassName?: string;
  queued?: ReactNode;
  queuedClassName?: string;
  inputGroupClassName?: string;
  inputStart?: ReactNode;
  inputStartClassName?: string;
  leadingActions?: ReactNode;
  leadingActionsClassName?: string;
  textareaClassName?: string;
  trailingActions?: ReactNode;
  trailingActionsClassName?: string;
} & (
    | { input?: undefined; onValueChange: (value: string) => void }
    | { input: ReactNode; onValueChange?: (value: string) => void }
  );

const HEADER_OVERLAP_PX = 8;

const AgentComposerContext: Context<AgentComposerContextValue | null> =
  createContext<AgentComposerContextValue | null>(null);

function useAgentComposerContext(): AgentComposerContextValue {
  const context = useContext(AgentComposerContext);
  if (!context) {
    throw new Error("AgentComposer parts must be rendered inside AgentComposerRoot");
  }
  return context;
}

export function AgentComposerRoot({
  composerProps,
  layout,
  inputRef,
  allowSubmitWhileBusy = false,
  autoFocus = true,
  autoComplete = "off",
  children,
  className,
  disabled = false,
  inputLabel,
  isBusy = false,
  name,
  onStop,
  onSubmit,
  onValueChange,
  placeholder,
  rows = 5,
  sendLabel,
  stopLabel,
  value,
}: AgentComposerRootProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const submit = (): void => {
    if (!value.trim()) {
      (inputRef?.current ?? textareaRef.current ?? getAgentComposerInput(rootRef.current))?.focus();
      return;
    }

    onSubmit();
  };

  return (
    <AgentComposerContext.Provider
      value={{
        composerProps,
        layout,
        allowSubmitWhileBusy,
        autoFocus,
        autoComplete,
        disabled,
        inputLabel,
        isBusy,
        name,
        onStop,
        onSubmit: submit,
        onValueChange,
        placeholder,
        rows,
        sendLabel,
        stopLabel,
        textareaRef,
        value,
      }}>
      <div ref={rootRef} className={cn("w-full", className)}>
        {children}
      </div>
    </AgentComposerContext.Provider>
  );
}

export function AgentComposerFrame({
  className,
  headerOpen = true,
  withFooter,
  withHeader,
  children,
}: AgentComposerFrameProps): React.ReactElement {
  const { disabled } = useAgentComposerContext();
  // With a header the input shell carries the visible border, and its own glow (see AgentComposerInput).
  const glow = usePointerGlow();
  const glowEnabled = !disabled && !withHeader;
  let glowHandlers = {};
  if (glowEnabled) glowHandlers = glow.handlers;
  let backdrop: React.ReactElement | null = null;
  if (withHeader) {
    let backdropClassName =
      "inset-0.5 opacity-0 ease-in [transition-delay:0ms,200ms] [transition-duration:200ms,0ms]";
    let backdropState: "closed" | "open" = "closed";
    if (headerOpen) {
      backdropClassName =
        "-inset-x-0.5 top-0 -bottom-0.5 opacity-100 ease-out [transition-delay:0ms,0ms] [transition-duration:200ms,0ms]";
      backdropState = "open";
    }
    backdrop = (
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute rounded-[calc(var(--agent-composer-radius,var(--radius-lg))+2px)] bg-muted [transition-property:inset,opacity] motion-reduce:transition-none",
          backdropClassName
        )}
        data-slot="agent-composer-frame-backdrop"
        data-state={backdropState}
      />
    );
  }

  return (
    <div
      className={cn(
        !withHeader && !withFooter && "relative rounded-lg",
        withHeader && "relative flex flex-col",
        withFooter &&
          "relative flex flex-col rounded-lg border bg-card text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        withHeader && withFooter && "border-0 bg-transparent shadow-none before:hidden",
        className
      )}
      data-slot="agent-composer-frame"
      {...glowHandlers}>
      {backdrop}
      {children}
      {!withHeader && <PointerGlowOverlay isLit={glowEnabled && glow.isLit} />}
    </div>
  );
}

export function AgentComposerInput({
  className,
  withFooter,
  withHeader,
  children,
}: AgentComposerInputProps): React.ReactElement {
  const {
    composerProps,
    layout,
    disabled,
    isBusy,
    allowSubmitWhileBusy,
    onSubmit,
    onValueChange,
    name,
    rows,
    value,
  } = useAgentComposerContext();
  const glow = usePointerGlow();
  const glowEnabled = !disabled && Boolean(withHeader);
  let glowHandlers = {};
  if (glowEnabled) glowHandlers = glow.handlers;
  const input = (
    <Composer
      render={<div />}
      value={value ? [{ type: "text", text: value }] : []}
      onValueChange={(draft) => onValueChange?.(getComposerText(draft))}
      onSubmit={onSubmit}
      allowEmpty
      disabled={disabled}
      submitDisabled={isBusy && !allowSubmitWhileBusy}
      name={name}
      layout={layout}
      style={{ "--composer-min-rows": rows } as CSSProperties}
      {...composerProps}
      className={cn(
        // No focus ring: the frame lights its border under the pointer instead.
        "[--composer-radius:var(--agent-composer-radius,var(--radius-lg))] [--composer-max-height:12rem] has-[[data-slot=composer-input]:focus-visible]:border-foreground/16 has-[[data-slot=composer-input]:focus-visible]:ring-0",
        withHeader && "relative",
        withFooter &&
          !withHeader &&
          "z-10 -m-px w-[calc(100%+2px)] rounded-b-md bg-background shadow-none [clip-path:inset(1px_1px_-1rem_1px_round_calc(var(--radius-lg)-1px))] before:hidden",
        className
      )}>
      {children}
    </Composer>
  );

  if (!withHeader) {
    return input;
  }

  return (
    <div className="relative z-10 rounded-lg" data-slot="agent-composer-input-shell" {...glowHandlers}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg bg-popover"
        data-slot="agent-composer-input-shield"
      />
      {input}
      <PointerGlowOverlay isLit={glowEnabled && glow.isLit} />
    </div>
  );
}

export function AgentComposerTextarea({ className }: AgentComposerTextareaProps): React.ReactElement {
  const { autoComplete, autoFocus, inputLabel, placeholder, rows, textareaRef } = useAgentComposerContext();
  return (
    <ComposerInput
      render={
        <textarea
          aria-label={inputLabel}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          data-testid="ai-chat-input"
          ref={textareaRef}
          rows={rows}
        />
      }
      placeholder={placeholder}
      className={className}
    />
  );
}

export function AgentComposerHeader({
  className,
  children,
  open = true,
}: AgentComposerSlotProps & { open?: boolean }): React.ReactElement {
  const labelRef = useRef<HTMLDivElement>(null);
  const [labelHeight, setLabelHeight] = useState(0);
  let headerState: "closed" | "open" = "closed";
  let inert: true | undefined;
  let rowsClassName = "grid-rows-[0fr] ease-in";
  if (open) {
    headerState = "open";
    rowsClassName = "grid-rows-[1fr] ease-out";
  } else {
    inert = true;
  }

  useLayoutEffect(() => {
    const node = labelRef.current;
    if (!node) return;
    const updateHeight = (): void => {
      setLabelHeight(node.offsetHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden={!open}
      className="relative z-0 -mb-2 min-w-0 overflow-hidden"
      data-slot="agent-composer-header"
      data-state={headerState}
      inert={inert}>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          rowsClassName
        )}>
        <div className="min-h-0 overflow-hidden">
          <div aria-hidden="true" style={{ height: labelHeight + HEADER_OVERLAP_PX }} />
        </div>
      </div>
      <div
        ref={labelRef}
        className={cn("absolute inset-x-0 top-0 flex min-w-0 flex-col items-stretch gap-0.5 p-1", className)}
        data-slot="agent-composer-header-label">
        {children}
      </div>
    </div>
  );
}

export function AgentComposerActions({ className, children }: AgentComposerActionsProps): React.ReactElement {
  return (
    <ComposerActions className={className}>
      <TooltipProvider>{children}</TooltipProvider>
    </ComposerActions>
  );
}

export function AgentComposerLeading({ className, children }: AgentComposerSlotProps): React.ReactElement {
  if (children == null) return <></>;
  return <ComposerActionGroup className={className}>{children}</ComposerActionGroup>;
}

export function AgentComposerTrailing({ className, children }: AgentComposerSlotProps): React.ReactElement {
  return (
    <ComposerActionGroup align="end" className={cn("gap-2.5", className)}>
      {children}
    </ComposerActionGroup>
  );
}

export function AgentComposerSubmit(): React.ReactElement {
  const { allowSubmitWhileBusy, isBusy, onStop, sendLabel, stopLabel, value } = useAgentComposerContext();

  if (isBusy && (!allowSubmitWhileBusy || !value.trim())) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label={stopLabel}
              className="rounded-full"
              data-testid="ai-chat-stop"
              onClick={onStop}
              size="icon-sm"
              type="button"
              variant="secondary"
            />
          }>
          <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-current" />
        </TooltipTrigger>
        <TooltipPopup side="bottom">{stopLabel}</TooltipPopup>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ComposerSubmit
            render={<Button className="rounded-full" size="icon-sm" />}
            aria-label={sendLabel}
            data-testid="ai-chat-send"
          />
        }>
        <ArrowUpIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup side="bottom">{sendLabel}</TooltipPopup>
    </Tooltip>
  );
}

export function AgentComposerQueued({ className, children }: AgentComposerSlotProps): React.ReactElement {
  return (
    <div
      className={cn("flex w-full min-w-0 flex-col items-stretch p-1.5", className)}
      data-slot="agent-composer-queued">
      {children}
    </div>
  );
}

export function AgentComposerQueuedMessage({
  children,
  className,
  onRemove,
  onSend,
  removeLabel,
  sendLabel,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  onRemove?: () => void;
  onSend?: () => void;
  removeLabel?: string;
  sendLabel?: string;
}): React.ReactElement {
  const showSend = onSend != null && sendLabel != null;
  const showRemove = onRemove != null && removeLabel != null;

  return (
    <div
      {...props}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground text-sm focus-within:bg-secondary hover:bg-secondary",
        className
      )}
      data-slot="agent-composer-queued-message"
      data-testid="agent-queued-message">
      <CornerDownRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {(showSend || showRemove) && (
        <div className="flex shrink-0 items-center">
          <TooltipProvider>
            {showSend && (
              <AgentIconAction label={sendLabel} onClick={onSend}>
                <ArrowUpIcon aria-hidden="true" />
              </AgentIconAction>
            )}
            {showRemove && (
              <AgentIconAction label={removeLabel} onClick={onRemove}>
                <XIcon aria-hidden="true" />
              </AgentIconAction>
            )}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

export function AgentComposerFooter({ className, children }: AgentComposerFooterProps): React.ReactElement {
  return <div className={cn("z-10 flex justify-end px-2 py-1", className)}>{children}</div>;
}

export function AgentComposerHint({ className, children }: AgentComposerHintProps): React.ReactElement {
  return <p className={cn("mt-2 text-center text-muted-foreground text-xs", className)}>{children}</p>;
}

export function AgentComposer({
  composerProps,
  layout,
  input,
  inputRef,
  actionRowClassName,
  allowSubmitWhileBusy,
  autoFocus,
  autoComplete,
  className,
  disabled,
  footer,
  footerClassName,
  frameClassName,
  header,
  headerClassName,
  headerOpen,
  hint,
  hintClassName,
  queued,
  queuedClassName,
  inputLabel,
  inputGroupClassName,
  inputStart,
  inputStartClassName,
  isBusy,
  leadingActions,
  leadingActionsClassName,
  name,
  onStop,
  onSubmit,
  onValueChange,
  placeholder,
  rows = 5,
  sendLabel,
  stopLabel,
  textareaClassName,
  trailingActions,
  trailingActionsClassName,
  value,
}: AgentComposerProps): React.ReactElement {
  const isHeaderOpen = headerOpen ?? header != null;

  return (
    <AgentComposerRoot
      composerProps={composerProps}
      layout={layout}
      inputRef={inputRef}
      allowSubmitWhileBusy={allowSubmitWhileBusy}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      className={className}
      disabled={disabled}
      inputLabel={inputLabel}
      isBusy={isBusy}
      name={name}
      onStop={onStop}
      onSubmit={onSubmit}
      onValueChange={onValueChange}
      placeholder={placeholder}
      rows={rows}
      sendLabel={sendLabel}
      stopLabel={stopLabel}
      value={value}>
      {queued != null && <AgentComposerQueued className={queuedClassName}>{queued}</AgentComposerQueued>}
      <AgentComposerFrame
        className={frameClassName}
        headerOpen={isHeaderOpen}
        withFooter={Boolean(footer)}
        withHeader={header != null}>
        {header != null && (
          <AgentComposerHeader className={headerClassName} open={isHeaderOpen}>
            {header}
          </AgentComposerHeader>
        )}
        <AgentComposerInput
          className={inputGroupClassName}
          withFooter={Boolean(footer)}
          withHeader={header != null}>
          {input ?? <AgentComposerTextarea className={textareaClassName} />}
          <AgentComposerActions className={actionRowClassName}>
            <AgentComposerLeading className={leadingActionsClassName}>
              {inputStart != null && (
                <div data-slot="agent-composer-decoration" className={inputStartClassName}>
                  {inputStart}
                </div>
              )}
              {leadingActions}
            </AgentComposerLeading>
            <AgentComposerTrailing className={trailingActionsClassName}>
              {trailingActions}
              <AgentComposerSubmit />
            </AgentComposerTrailing>
          </AgentComposerActions>
        </AgentComposerInput>
        {footer && <AgentComposerFooter className={footerClassName}>{footer}</AgentComposerFooter>}
      </AgentComposerFrame>
      {hint && <AgentComposerHint className={hintClassName}>{hint}</AgentComposerHint>}
    </AgentComposerRoot>
  );
}

export type { AgentComposerProps, AgentComposerRootProps };
