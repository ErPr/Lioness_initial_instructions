"use client";

import type { MiniMapData } from "@/lib/minimapQuery";
import { CARD_H, CARD_W, HEADER_H } from "@/lib/treeLayout";
import type { Tier } from "@/lib/types";

const TIER_FILL: Record<Tier, string> = {
  PURPOSE: "#f59e0b",
  ROOT_ISSUE: "#f43f5e",
  GOAL: "#38bdf8",
  STRATEGY: "#34d399",
  TACTIC: "#a78bfa",
  ACTION: "#f472b6",
};

/** Inline scaled rendering of a board's tree (same data as the minimap). */
export default function TreeThumb({
  data,
  width,
  height,
}: {
  data: MiniMapData;
  width: number;
  height: number;
}) {
  const { layout, meta } = data;
  if (layout.instances.length === 0) return null;
  const contentH = layout.height - HEADER_H;
  const scale = Math.min(width / layout.width, height / contentH);
  const w = Math.ceil(layout.width * scale);
  const h = Math.ceil(contentH * scale);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      {layout.edges.map((e) => (
        <line
          key={e.key}
          x1={e.x1 * scale}
          y1={(e.y1 - HEADER_H) * scale}
          x2={e.x2 * scale}
          y2={(e.y2 - HEADER_H) * scale}
          style={{ stroke: "var(--edge)" }}
          strokeWidth={1}
        />
      ))}
      {layout.instances.map((inst) => {
        const m = meta[inst.nodeId];
        if (!m) return null;
        const isStub = m.status === "STUB";
        return (
          <rect
            key={inst.key}
            x={inst.x * scale}
            y={(inst.y - HEADER_H) * scale}
            width={Math.max(5, CARD_W * scale)}
            height={Math.max(3, CARD_H * scale)}
            rx={2}
            fill={
              isStub
                ? "var(--status-proposed)"
                : (TIER_FILL[m.tier as Tier] ?? "#a8a29e")
            }
            fillOpacity={isStub ? 0.5 : m.status === "PROPOSED" ? 0.5 : 0.95}
            stroke={m.status === "CONTESTED" ? "var(--status-contested)" : "none"}
            strokeWidth={1}
          >
            <title>{m.title}</title>
          </rect>
        );
      })}
    </svg>
  );
}
