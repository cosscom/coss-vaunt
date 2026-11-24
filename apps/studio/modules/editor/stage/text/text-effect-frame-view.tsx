import type { StyledTextUnit, TextEffectFrame } from "@coss/vaunt-engine/text/evaluate-text-effect";
import type { UnitStyle } from "@coss/vaunt-engine/text/unit-style";
import type * as React from "react";

const UNIT_BASE: React.CSSProperties = {
  display: "inline-block",
  whiteSpace: "pre",
  transformOrigin: "50% 55%",
  backfaceVisibility: "hidden",
};

const inline = (style: UnitStyle): React.CSSProperties => ({
  opacity: style.opacity,
  transform: style.transform,
  filter: style.filter,
});

/** Character units of one word share a no-wrap run so lines only break between words. */
function groupCharactersIntoWords(units: readonly StyledTextUnit[]): StyledTextUnit[][] {
  const groups: StyledTextUnit[][] = [];
  for (const unit of units) {
    const isGap = /^\s+$/.test(unit.text);
    const last = groups[groups.length - 1];
    if (!isGap && last && !/^\s+$/.test(last[0].text)) last.push(unit);
    else groups.push([unit]);
  }
  return groups;
}

function FlowUnits({ frame }: { frame: Extract<TextEffectFrame, { layout: "flow" }> }): React.ReactNode {
  const { target, units } = frame;
  if (target === "per-line") {
    return units.map((unit, index) => (
      <span key={index} style={{ ...UNIT_BASE, display: "block", ...inline(unit.style) }}>
        {unit.text}
      </span>
    ));
  }
  if (target === "per-character") {
    return groupCharactersIntoWords(units).map((group, groupIndex) => (
      <span key={groupIndex} style={{ whiteSpace: "nowrap" }}>
        {group.map((unit, index) => (
          <span key={index} style={{ ...UNIT_BASE, ...inline(unit.style) }}>
            {unit.text}
          </span>
        ))}
      </span>
    ));
  }
  if (target === "per-word") {
    return units.map((unit, index) =>
      unit.animated ? (
        <span key={index} style={{ ...UNIT_BASE, ...inline(unit.style) }}>
          {unit.text}
        </span>
      ) : (
        unit.text
      )
    );
  }
  return units.map((unit, index) => (
    <span key={index} style={{ ...UNIT_BASE, whiteSpace: "normal", ...inline(unit.style) }}>
      {unit.text}
    </span>
  ));
}

/** One evaluated text frame as live DOM text; typography comes from the parent. */
export function TextEffectFrameView({ frame }: { frame: TextEffectFrame }): React.ReactElement {
  if (frame.layout === "flow") {
    return (
      <span style={{ display: "inline-block", ...inline(frame.container) }}>
        <FlowUnits frame={frame} />
      </span>
    );
  }
  return (
    <span style={{ display: "inline-block", position: "relative", width: frame.width, height: frame.height }}>
      {frame.units.map((unit, index) => (
        <span
          key={index}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            whiteSpace: "nowrap",
            backfaceVisibility: "hidden",
            ...inline(unit.style),
          }}>
          {unit.text}
        </span>
      ))}
    </span>
  );
}
