"use client";

import { cn } from "@coss/ui/lib/utils";
import type * as React from "react";
import { useEffect, useRef } from "react";
import {
  addBeam,
  Beam,
  type BeamOptions,
  type BeamState,
  COMPOSER_BEAM,
  removeBeam,
  wake,
} from "./border-beam-engine";

/**
 * Wraps one element and lights its border: an orbiting beam while `active`, a green ring on `success`, easing
 * between them. Takes the corner radius from the wrapped element; without WebGL it renders the element alone.
 */
export function BorderBeam({
  state,
  options = COMPOSER_BEAM,
  className,
  children,
}: {
  state: BeamState;
  options?: BeamOptions;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const beam = useRef<Beam | null>(null);

  useEffect(() => {
    if (!host.current || !canvas.current) return;
    const instance = new Beam(host.current, canvas.current);
    if (!addBeam(instance)) return;
    beam.current = instance;
    return () => {
      removeBeam(instance);
      beam.current = null;
    };
  }, []);

  useEffect(() => {
    beam.current?.set(options, state);
    wake();
  }, [state, options]);

  return (
    <div className={cn("relative isolate", className)} ref={host}>
      {children}
      <canvas aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-10" ref={canvas} />
    </div>
  );
}
