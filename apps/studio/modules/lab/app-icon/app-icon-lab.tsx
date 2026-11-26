"use client";

import { Button } from "@coss/ui/components/button";
import { Slider } from "@coss/ui/components/slider";
import { Switch } from "@coss/ui/components/switch";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AppIconConfig,
  DEFAULT_CONFIG,
  downscaleInto,
  type IconMode,
  KNOB_GROUPS,
  MODE_PRESETS,
  type NumberKnob,
  normalizeConfig,
  renderAppIcon,
} from "./render-app-icon";

type SavedIcon = { id: string; savedAt: string; config: Partial<AppIconConfig> };
type IconFile = { current: Partial<AppIconConfig> | null; saved: SavedIcon[]; path?: string };

const PREVIEW_SIZES = [16, 32, 64, 128];
const API = "/api/lab/app-icon";

const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** Live controls for the app icon: big canvas, small sizes, a dock mock and a rail of saved keepers. */
export function AppIconLab({ back }: { back: string }): React.ReactElement {
  const [config, setConfig] = useState<AppIconConfig>(DEFAULT_CONFIG);
  const [file, setFile] = useState<IconFile>({ current: null, saved: [] });
  const [status, setStatus] = useState("");
  const [renderMs, setRenderMs] = useState(0);
  const [wallpaper, setWallpaper] = useState<"dark" | "light">("dark");
  const big = useRef<HTMLCanvasElement>(null);
  const smalls = useRef<(HTMLCanvasElement | null)[]>([]);
  const dock = useRef<HTMLCanvasElement>(null);

  // Start from the saved keeper, if there is one.
  useEffect(() => {
    let live = true;
    fetch(API)
      .then((response) => (response.ok ? (response.json() as Promise<IconFile>) : null))
      .then((data) => {
        if (!live || !data) return;
        setFile(data);
        if (data.current) setConfig(normalizeConfig(data.current));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = big.current;
      if (!canvas) return;
      const started = performance.now();
      renderAppIcon(canvas, config);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      PREVIEW_SIZES.forEach((size, i) => {
        const target = smalls.current[i];
        if (target) downscaleInto(canvas, target, size, dpr);
      });
      if (dock.current) downscaleInto(canvas, dock.current, 64, dpr);
      setRenderMs(Math.round(performance.now() - started));
    });
    return () => cancelAnimationFrame(frame);
  }, [config]);

  const set = useCallback(<K extends keyof AppIconConfig>(key: K, value: AppIconConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  }, []);

  const pickMode = (mode: IconMode) =>
    setConfig((current) => ({ ...MODE_PRESETS[mode].config, seed: current.seed }));

  const save = async () => {
    const json = JSON.stringify(config, null, 2);
    let copied = false;
    try {
      await navigator.clipboard.writeText(json);
      copied = true;
    } catch {
      copied = false;
    }
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as IconFile;
      setFile(data);
      setStatus(`Saved to ${shortPath(data.path)}${copied ? " and copied" : " (clipboard unavailable)"}`);
    } catch (error) {
      setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const remove = async (id: string) => {
    const response = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setFile((await response.json()) as IconFile);
  };

  const exportPng = () => {
    big.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vaunt-app-icon-${config.mode}-${config.seed}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Exported 1024 × 1024 PNG");
    }, "image/png");
  };

  const testRanges = () => {
    const scratch = document.createElement("canvas");
    const failures: string[] = [];
    let runs = 0;
    for (const mode of Object.keys(MODE_PRESETS) as IconMode[]) {
      for (const group of KNOB_GROUPS) {
        for (const knob of group.knobs) {
          for (const value of [knob.min, knob.max]) {
            runs++;
            try {
              const probe = { ...MODE_PRESETS[mode].config, [knob.key]: value };
              renderAppIcon(scratch, probe);
              const alpha = scratch.getContext("2d")?.getImageData(512, 512, 1, 1).data[3] ?? 0;
              if (alpha === 0) failures.push(`${mode} ${knob.key}=${value}: empty`);
            } catch (error) {
              failures.push(`${mode} ${knob.key}=${value}: ${String(error)}`);
            }
          }
        }
      }
    }
    const message = failures.length
      ? `Range test: ${failures.length}/${runs} failed — ${failures.slice(0, 3).join("; ")}`
      : `Range test: all ${runs} min/max renders OK`;
    setStatus(message);
    if (failures.length) console.warn(failures);
  };

  return (
    <div className="dark fixed inset-0 flex bg-[#0b0b0d] pt-(--titlebar-inset) text-foreground">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-border/60 border-b px-4 py-2.5">
          <a className="text-muted-foreground text-sm hover:text-foreground" href={back}>
            ← Back
          </a>
          <span className="font-heading font-semibold text-sm">App icon lab</span>
          <span className="text-muted-foreground text-xs tabular-nums">
            seed {config.seed} · {renderMs} ms
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button onClick={() => set("seed", newSeed())} size="sm" variant="ghost">
              New seed
            </Button>
            <Button onClick={testRanges} size="sm" variant="ghost">
              Test ranges
            </Button>
            <Button onClick={exportPng} size="sm" variant="outline">
              Export PNG
            </Button>
            <Button onClick={save} size="sm">
              Save
            </Button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-auto p-6">
          <div className="flex items-center gap-10">
            <button
              aria-label="New seed"
              className="relative cursor-pointer rounded-[22%] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => set("seed", newSeed())}
              title="Click for a new seed"
              type="button">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-3xl opacity-60"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #ffffff08 25%, transparent 25%, transparent 75%, #ffffff08 75%), linear-gradient(45deg, #ffffff08 25%, transparent 25%, transparent 75%, #ffffff08 75%)",
                  backgroundSize: "24px 24px",
                  backgroundPosition: "0 0, 12px 12px",
                }}
              />
              <canvas className="block size-[min(52vh,520px)]" height={1024} ref={big} width={1024} />
            </button>
            <div className="flex flex-col items-center gap-5">
              {PREVIEW_SIZES.map((size, i) => (
                <div className="flex flex-col items-center gap-1.5" key={size}>
                  <canvas
                    ref={(node) => {
                      smalls.current[i] = node;
                    }}
                    style={{ width: size, height: size }}
                  />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{size}</span>
                </div>
              ))}
            </div>
          </div>

          <DockStrip dockRef={dock} wallpaper={wallpaper} />
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            Wallpaper
            <Switch
              checked={wallpaper === "light"}
              onCheckedChange={(checked) => setWallpaper(checked ? "light" : "dark")}
            />
            {wallpaper}
          </div>
        </main>

        <footer className="border-border/60 border-t px-4 py-3">
          <div className="mb-2 flex items-center gap-3 text-xs">
            <span className="font-medium">Saved</span>
            <span className="truncate text-muted-foreground">
              {status ||
                (file.path ? shortPath(file.path) : "Save writes the config here and to the clipboard")}
            </span>
          </div>
          <div className="flex min-h-16 gap-2 overflow-x-auto pb-1">
            {file.saved.length === 0 ? (
              <span className="self-center text-muted-foreground text-xs">Nothing saved yet.</span>
            ) : (
              file.saved.map((entry) => (
                <SavedThumb
                  entry={entry}
                  key={entry.id}
                  onPick={() => setConfig(normalizeConfig(entry.config))}
                  onRemove={() => remove(entry.id)}
                />
              ))
            )}
          </div>
        </footer>
      </div>

      <aside className="w-[340px] shrink-0 overflow-y-auto border-border/60 border-l px-4 py-3">
        <Section title="Mode">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(MODE_PRESETS) as IconMode[]).map((mode) => (
              <button
                className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                  config.mode === mode ? "border-primary/60 bg-accent" : "border-border hover:bg-accent/50"
                }`}
                key={mode}
                onClick={() => pickMode(mode)}
                type="button">
                <div className="font-medium text-xs">{MODE_PRESETS[mode].label}</div>
                <div className="text-[10px] text-muted-foreground">{MODE_PRESETS[mode].hint}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Tile">
          <Choice
            onChange={(value) => set("tileStyle", value)}
            options={["linear", "radial"] as const}
            value={config.tileStyle}
          />
          <ColorRow label="From" onChange={(value) => set("tileFrom", value)} value={config.tileFrom} />
          <ColorRow label="To" onChange={(value) => set("tileTo", value)} value={config.tileTo} />
          <Knobs config={config} group="Tile" set={set} />
          <div className="flex items-center justify-between py-1 text-xs">
            <span>Monotone</span>
            <Switch checked={config.monotone} onCheckedChange={(checked) => set("monotone", checked)} />
          </div>
          {config.monotone ? (
            <ColorRow
              label="Mono tint"
              onChange={(value) => set("monoTint", value)}
              value={config.monoTint}
            />
          ) : null}
        </Section>

        <Section title="Glyph">
          <Choice
            onChange={(value) => set("glyphFill", value)}
            options={["solid", "gradient"] as const}
            value={config.glyphFill}
          />
          <ColorRow
            label={config.glyphFill === "gradient" ? "Top" : "Colour"}
            onChange={(value) => set("glyphFrom", value)}
            value={config.glyphFrom}
          />
          {config.glyphFill === "gradient" ? (
            <ColorRow label="Bottom" onChange={(value) => set("glyphTo", value)} value={config.glyphTo} />
          ) : null}
          <Knobs config={config} group="Glyph" set={set} />
        </Section>

        {KNOB_GROUPS.filter((group) => group.title !== "Tile" && group.title !== "Glyph").map((group) => (
          <Section key={group.title} title={group.title}>
            <Knobs config={config} group={group.title} set={set} />
          </Section>
        ))}

        <Section title="Seed">
          <div className="flex items-center gap-2">
            <input
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs tabular-nums"
              min={0}
              onChange={(event) => set("seed", Math.max(0, Math.round(Number(event.target.value) || 0)))}
              type="number"
              value={config.seed}
            />
            <Button
              onClick={() => setConfig((c) => ({ ...MODE_PRESETS[c.mode].config, seed: c.seed }))}
              size="xs"
              variant="ghost">
              Reset knobs
            </Button>
          </div>
        </Section>
      </aside>
    </div>
  );
}

function shortPath(value?: string): string {
  if (!value) return "app-icon.config.json";
  const at = value.indexOf("apps/studio/");
  return at >= 0 ? value.slice(at) : value;
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="border-border/50 border-b py-3 last:border-b-0">
      <h2 className="mb-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">{title}</h2>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function Knobs({
  config,
  group,
  set,
}: {
  config: AppIconConfig;
  group: string;
  set: <K extends keyof AppIconConfig>(key: K, value: AppIconConfig[K]) => void;
}): React.ReactElement {
  const knobs = KNOB_GROUPS.find((g) => g.title === group)?.knobs ?? [];
  return (
    <>
      {knobs.map((knob) => (
        <KnobRow
          knob={knob}
          key={knob.key}
          onChange={(value) => set(knob.key, value)}
          value={config[knob.key]}
        />
      ))}
    </>
  );
}

function KnobRow({
  knob,
  value,
  onChange,
}: {
  knob: NumberKnob;
  value: number;
  onChange: (value: number) => void;
}): React.ReactElement {
  const decimals = knob.step < 0.1 ? 2 : knob.step < 1 ? 1 : 0;
  return (
    <div className="grid grid-cols-[96px_1fr_44px] items-center gap-2">
      <span className="truncate text-xs" title={`${knob.min} – ${knob.max}`}>
        {knob.label}
      </span>
      <Slider
        className="[&_[data-slot=slider-control]]:min-w-0"
        max={knob.max}
        min={knob.min}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
        step={knob.step}
        value={value}
      />
      <span className="text-right text-[11px] text-muted-foreground tabular-nums">
        {value.toFixed(decimals)}
      </span>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <label className="grid grid-cols-[96px_28px_1fr] items-center gap-2 text-xs">
      <span>{label}</span>
      <input
        className="size-6 cursor-pointer rounded border border-input bg-transparent p-0"
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value}
      />
      <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
    </label>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}): React.ReactElement {
  return (
    <div className="flex gap-1 rounded-lg bg-input/40 p-0.5">
      {options.map((option) => (
        <button
          className={`flex-1 rounded-md px-2 py-1 text-xs capitalize transition-colors ${
            option === value
              ? "bg-background text-foreground shadow-sm/5"
              : "text-muted-foreground hover:text-foreground"
          }`}
          key={option}
          onClick={() => onChange(option)}
          type="button">
          {option}
        </button>
      ))}
    </div>
  );
}

function SavedThumb({
  entry,
  onPick,
  onRemove,
}: {
  entry: SavedIcon;
  onPick: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const thumb = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const target = thumb.current;
    if (!target) return;
    const source = document.createElement("canvas");
    renderAppIcon(source, normalizeConfig(entry.config));
    downscaleInto(source, target, 56, Math.min(window.devicePixelRatio || 1, 2));
  }, [entry]);
  const config = normalizeConfig(entry.config);
  return (
    <div className="group relative shrink-0">
      <button
        className="block rounded-xl p-0.5 hover:bg-accent"
        onClick={onPick}
        title={`${MODE_PRESETS[config.mode].label} · seed ${config.seed} · ${new Date(entry.savedAt).toLocaleString()}`}
        type="button">
        <canvas className="block" ref={thumb} style={{ width: 56, height: 56 }} />
      </button>
      <button
        aria-label="Remove from rail"
        className="absolute -top-1 -right-1 hidden size-4 items-center justify-center rounded-full bg-popover text-[10px] text-muted-foreground shadow group-hover:flex hover:text-foreground"
        onClick={onRemove}
        type="button">
        ×
      </button>
    </div>
  );
}

/** Generic neighbours (deliberately not real apps) so the icon can be judged in a dock. */
const NEIGHBOURS = [
  { bg: "linear-gradient(180deg,#5ac8fa,#007aff)", glyph: "circle" },
  { bg: "linear-gradient(180deg,#f2f2f7,#d1d1d6)", glyph: "grid" },
  { bg: "linear-gradient(180deg,#34c759,#248a3d)", glyph: "bubble" },
  null,
  { bg: "linear-gradient(180deg,#2c2c2e,#000)", glyph: "prompt" },
  { bg: "linear-gradient(180deg,#ff9f0a,#ff6b00)", glyph: "star" },
  { bg: "linear-gradient(180deg,#ffffff,#e5e5ea)", glyph: "lines" },
] as const;

function DockStrip({
  dockRef,
  wallpaper,
}: {
  dockRef: React.RefObject<HTMLCanvasElement | null>;
  wallpaper: "dark" | "light";
}): React.ReactElement {
  return (
    <div
      className="flex w-[min(100%,640px)] justify-center rounded-2xl px-6 pt-16 pb-3"
      style={{
        background:
          wallpaper === "dark"
            ? "radial-gradient(120% 140% at 30% 0%, #2a2350 0%, #12101f 55%, #08080c 100%)"
            : "radial-gradient(120% 140% at 30% 0%, #f5d0c5 0%, #c7d2fe 55%, #a5b4fc 100%)",
      }}>
      <div
        className={`flex items-end gap-2 rounded-[22px] border px-2.5 pt-2 pb-1.5 backdrop-blur-xl ${
          wallpaper === "dark" ? "border-white/12 bg-white/8" : "border-white/50 bg-white/35"
        }`}>
        {NEIGHBOURS.map((n, i) =>
          n === null ? (
            <div className="flex flex-col items-center gap-1" key="vaunt">
              <canvas className="block" ref={dockRef} style={{ width: 64, height: 64 }} />
              <span
                className={`size-1 rounded-full ${wallpaper === "dark" ? "bg-white/70" : "bg-black/60"}`}
              />
            </div>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative list.
            <div className="flex flex-col items-center gap-1" key={i}>
              <NeighbourIcon bg={n.bg} glyph={n.glyph} />
              <span className="size-1" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function NeighbourIcon({ bg, glyph }: { bg: string; glyph: string }): React.ReactElement {
  // Drawn on the same grid as the real icon: an 824/1024 tile with a squircle-ish radius.
  const ink = bg.includes("#fff") || bg.includes("#f2f2f7") ? "#3a3a3c" : "#ffffff";
  return (
    <div className="flex size-16 items-center justify-center">
      <div
        className="flex size-[51.5px] items-center justify-center rounded-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        style={{ background: bg }}>
        <svg
          aria-hidden="true"
          fill="none"
          height="26"
          stroke={ink}
          strokeLinecap="round"
          strokeWidth="2.6"
          viewBox="0 0 26 26"
          width="26">
          {glyph === "circle" ? <circle cx="13" cy="13" r="8" /> : null}
          {glyph === "grid" ? (
            <path d="M5 5h6v6H5zM15 5h6v6h-6zM5 15h6v6H5zM15 15h6v6h-6z" strokeLinejoin="round" />
          ) : null}
          {glyph === "bubble" ? (
            <path d="M5 12a8 7 0 1 1 4 6l-4 2 1-4a7 7 0 0 1-1-4z" strokeLinejoin="round" />
          ) : null}
          {glyph === "prompt" ? <path d="M6 8l5 5-5 5M13 19h7" strokeLinejoin="round" /> : null}
          {glyph === "star" ? (
            <path
              d="M13 4l2.6 6 6.4.5-4.9 4.2 1.5 6.3L13 17.6 7.4 21l1.5-6.3L4 10.5l6.4-.5z"
              strokeLinejoin="round"
            />
          ) : null}
          {glyph === "lines" ? <path d="M6 8h14M6 13h14M6 18h9" /> : null}
        </svg>
      </div>
    </div>
  );
}
