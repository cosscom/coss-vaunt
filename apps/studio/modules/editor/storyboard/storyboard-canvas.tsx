"use client";

import { Button } from "@coss/ui/components/button";
import { ContextMenu, ContextMenuTrigger } from "@coss/ui/components/context-menu";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@coss/ui/components/menu";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@coss/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@coss/ui/components/tooltip";
import { FocusIcon, Maximize2Icon, Minimize2Icon, PlusIcon, SplitIcon } from "@coss/ui/icons";
import { cn } from "@coss/ui/lib/utils";
import { BOARD_NODE_SIZE, type BoardIssue } from "@coss/vaunt-engine/storyboard/board-edits";
import { BOARD_NODE_KINDS, type BoardNode } from "@coss/vaunt-engine/storyboard/board-schema";
import {
  Background,
  BackgroundVariant,
  type EdgeChange,
  type EdgeTypes,
  type FitViewOptions,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { matchShortcut } from "../editor-keymap";
import {
  applySelectChanges,
  growthOffsets,
  type SceneFlowNode,
  type TransitionFlowEdge,
  toFlowEdges,
  toFlowNodes,
  widthFitViewport,
} from "./board-flow";
import type { NodeGeneration } from "./generation-stream";
import { SCENE_ICONS, SceneNode } from "./scene-node";
import { menuTargetFrom, StoryboardContextMenu, type StoryboardMenuTarget } from "./storyboard-context-menu";
import { EdgeActionsContext, TransitionEdge } from "./transition-edge";
import type { StoryboardActions } from "./use-storyboard-actions";
import { STUDIO_COPY } from "@/modules/studio-copy";
import "@xyflow/react/dist/base.css";

const copy = STUDIO_COPY.storyboard;
const nodeTypes: NodeTypes = { scene: SceneNode };
const edgeTypes: EdgeTypes = { transition: TransitionEdge };
// The top padding keeps the toolbar panel off the first node.
const WIDTH_FIT = { maxZoom: 0.9, minZoom: 0.6, inset: 16, top: 48 };
const FIT_OPTIONS: FitViewOptions = {
  padding: { top: "48px", right: "16px", bottom: "16px", left: "16px" },
  maxZoom: 1,
};
const TEXT_TARGET = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

type Position = BoardNode["position"];
type PendingDrop = { fromId: string; at: Position; clientX: number; clientY: number };

export type StoryboardCanvasProps = {
  actions: StoryboardActions;
  statuses: Record<string, NodeGeneration>;
  issues: readonly BoardIssue[];
  fullScreen: boolean;
  onToggleFullScreen: () => void;
  canRegenerate: boolean;
  onRegenerate: (nodeId: string) => void;
  /** Bumped when the board is replaced or re-laid out, to fit the view to it. */
  fitSignal: number;
  /** `width` keeps cards readable in the narrow sidebar: fit the width, scroll for the rest. */
  fit: "width" | "all";
  className?: string;
};

export function StoryboardCanvas(props: StoryboardCanvasProps): React.ReactElement {
  const [mounted, setMounted] = useState(false);
  // React Flow's theme class follows the app theme, which the server can't know; rendering it there mismatches.
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={props.className} />;
  return (
    <ReactFlowProvider>
      <EdgeActionsContext.Provider value={props.actions}>
        <CanvasInner {...props} />
      </EdgeActionsContext.Provider>
    </ReactFlowProvider>
  );
}

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarButton
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            render={<Button size="icon-xs" variant="ghost" />}
          />
        }>
        {children}
      </TooltipTrigger>
      <TooltipPopup>{label}</TooltipPopup>
    </Tooltip>
  );
}

function CanvasInner({
  actions,
  statuses,
  issues,
  fullScreen,
  onToggleFullScreen,
  canRegenerate,
  onRegenerate,
  fitSignal,
  fit: fitMode,
  className,
}: StoryboardCanvasProps): React.ReactElement {
  const flow = useReactFlow<SceneFlowNode, TransitionFlowEdge>();
  const { resolvedTheme } = useTheme();
  const [measured, setMeasured] = useState<Record<string, { width: number; height: number }>>({});
  const [menuTarget, setMenuTarget] = useState<StoryboardMenuTarget | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const { board, selection } = actions;
  const nodes = toFlowNodes(board, { selection, generation: statuses, issues, measured });
  const offsets = growthOffsets(board, measured);
  const edges = toFlowEdges(board, selection);
  const paneWidth = useStore((state) => state.width);
  const fit = (duration = 200) => {
    if (fitMode === "all") return void flow.fitView({ ...FIT_OPTIONS, duration });
    void flow.setViewport(widthFitViewport(board.nodes, BOARD_NODE_SIZE, paneWidth, WIDTH_FIT), { duration });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const fitted = useRef(false);
  /** Scrolls a new node into view at the current zoom, rather than re-fitting the whole board. */
  const reveal = (nodeId: string) =>
    window.setTimeout(() => {
      const node = flow.getNode(nodeId);
      if (!node) return;
      void flow.setCenter(
        node.position.x + BOARD_NODE_SIZE.width / 2,
        node.position.y + BOARD_NODE_SIZE.height / 2,
        { zoom: flow.getZoom(), duration: 200 }
      );
    }, 60);

  useEffect(() => {
    if (fitted.current || paneWidth === 0) return;
    fitted.current = true;
    // Fit view needs measured nodes, which arrive a frame after the pane does.
    window.setTimeout(() => fitRef.current(0), 60);
  }, [paneWidth]);

  useEffect(() => {
    if (fitSignal === 0) return;
    // New nodes are measured after a frame; fitting earlier would frame the old board.
    const timer = window.setTimeout(() => fitRef.current(), 60);
    return () => window.clearTimeout(timer);
  }, [fitSignal]);

  const onNodesChange = (changes: NodeChange<SceneFlowNode>[]) => {
    const positions: Record<string, Position> = {};
    const sizes: Record<string, { width: number; height: number }> = {};
    for (const change of changes) {
      // A node pushed down by a growing card above it is saved at the position it would have without that push.
      if (change.type === "position" && change.position)
        positions[change.id] = { ...change.position, y: change.position.y - (offsets[change.id] ?? 0) };
      if (change.type === "dimensions" && change.dimensions) sizes[change.id] = change.dimensions;
    }
    if (Object.keys(sizes).length > 0) setMeasured((current) => ({ ...current, ...sizes }));
    if (Object.keys(positions).length > 0) actions.move(positions);
    const nodeIds = applySelectChanges(selection.nodeIds, changes);
    if (nodeIds) actions.setSelection((current) => ({ ...current, nodeIds }));
  };

  const onEdgesChange = (changes: EdgeChange<TransitionFlowEdge>[]) => {
    const edgeIds = applySelectChanges(selection.edgeIds, changes);
    if (edgeIds) actions.setSelection((current) => ({ ...current, edgeIds }));
  };

  const onConnectEnd: OnConnectEnd = (event, state) => {
    if (state.isValid || !state.fromNode || state.fromHandle?.type !== "source") return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (!point) return;
    const at = flow.screenToFlowPosition({ x: point.clientX, y: point.clientY });
    setPendingDrop({
      fromId: state.fromNode.id,
      at: { x: at.x - BOARD_NODE_SIZE.width / 2, y: at.y },
      clientX: point.clientX,
      clientY: point.clientY,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Popovers on edges are portalled but still bubble here through React; their inputs keep their keys.
    if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return;
    if (event.target.closest(TEXT_TARGET)) return;
    const handlers: Partial<Record<NonNullable<ReturnType<typeof matchShortcut>>, () => void>> = {
      "delete-selection": () => actions.remove(),
      duplicate: () => actions.duplicate(),
      copy: () => actions.copy(),
      paste: actions.paste,
      "select-all": actions.selectAll,
    };
    const action = matchShortcut(event.nativeEvent);
    const handler = action ? handlers[action] : undefined;
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        aria-label={copy.canvas}
        className={cn("relative min-h-0 outline-none", className)}
        data-storyboard-canvas=""
        onContextMenu={(event) => {
          const target = menuTargetFrom(
            event.target instanceof Element ? event.target : null,
            flow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
          );
          if (target.kind === "node" && !selection.nodeIds.includes(target.nodeId))
            actions.selectNodes([target.nodeId]);
          if (target.kind === "edge") actions.setSelection({ nodeIds: [], edgeIds: [target.edgeId] });
          setMenuTarget(target);
        }}
        onKeyDown={onKeyDown}
        tabIndex={-1}>
        <ReactFlow<SceneFlowNode, TransitionFlowEdge>
          className="storyboard-flow"
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          deleteKeyCode={null}
          edgeTypes={edgeTypes}
          edges={edges}
          maxZoom={1.5}
          minZoom={0.25}
          nodeDragThreshold={4}
          nodeTypes={nodeTypes}
          nodes={nodes}
          onConnect={(connection) => actions.connect(connection.source, connection.target)}
          onConnectEnd={onConnectEnd}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          panOnScroll
          proOptions={{ hideAttribution: true }}
          selectionKeyCode="Shift"
          snapGrid={[8, 8]}
          snapToGrid>
          <Background
            color="color-mix(in srgb, var(--muted-foreground) 24%, transparent)"
            gap={16}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
          <Panel position="top-right">
            <Toolbar className="gap-0.5 rounded-lg p-0.5 shadow-xs/5">
              <Menu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <MenuTrigger
                        aria-label={copy.addNode}
                        render={<ToolbarButton render={<Button size="icon-xs" variant="ghost" />} />}
                      />
                    }>
                    <PlusIcon aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipPopup>{copy.addNode}</TooltipPopup>
                </Tooltip>
                <MenuPopup align="end">
                  {BOARD_NODE_KINDS.map((kind) => {
                    const Icon = SCENE_ICONS[kind];
                    return (
                      <MenuItem
                        key={kind}
                        onClick={() => {
                          reveal(actions.add(kind));
                        }}>
                        <Icon aria-hidden="true" />
                        {copy.kinds[kind]}
                      </MenuItem>
                    );
                  })}
                </MenuPopup>
              </Menu>
              <ToolbarIconButton
                disabled={board.nodes.length === 0}
                label={copy.autoLayout}
                onClick={() => {
                  actions.layout();
                  window.setTimeout(() => fitRef.current(), 60);
                }}>
                <SplitIcon aria-hidden="true" className="rotate-90" />
              </ToolbarIconButton>
              <ToolbarIconButton
                disabled={board.nodes.length === 0}
                label={copy.fitView}
                onClick={() => fit()}>
                <FocusIcon aria-hidden="true" />
              </ToolbarIconButton>
              <ToolbarSeparator orientation="vertical" />
              <ToolbarIconButton
                label={fullScreen ? copy.exitFullScreen : copy.fullScreen}
                onClick={onToggleFullScreen}>
                {fullScreen ? <Minimize2Icon aria-hidden="true" /> : <Maximize2Icon aria-hidden="true" />}
              </ToolbarIconButton>
            </Toolbar>
          </Panel>
        </ReactFlow>
        {board.nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="font-medium text-foreground text-sm">{copy.emptyTitle}</p>
            <p className="max-w-56 text-muted-foreground text-xs">{copy.emptyDescription}</p>
          </div>
        ) : null}
      </ContextMenuTrigger>
      <StoryboardContextMenu
        actions={actions}
        canRegenerate={canRegenerate}
        onRegenerate={onRegenerate}
        target={menuTarget}
      />
      <Menu onOpenChange={(open) => !open && setPendingDrop(null)} open={pendingDrop !== null}>
        <MenuPopup
          align="start"
          anchor={
            pendingDrop
              ? {
                  getBoundingClientRect: () =>
                    DOMRect.fromRect({ x: pendingDrop.clientX, y: pendingDrop.clientY, width: 0, height: 0 }),
                }
              : undefined
          }>
          {BOARD_NODE_KINDS.map((kind) => {
            const Icon = SCENE_ICONS[kind];
            return (
              <MenuItem
                key={kind}
                onClick={() => {
                  if (pendingDrop) actions.add(kind, pendingDrop.fromId, pendingDrop.at);
                  setPendingDrop(null);
                }}>
                <Icon aria-hidden="true" />
                {copy.kinds[kind]}
              </MenuItem>
            );
          })}
        </MenuPopup>
      </Menu>
    </ContextMenu>
  );
}
