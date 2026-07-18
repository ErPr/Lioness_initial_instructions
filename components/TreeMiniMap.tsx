"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CARD_H, CARD_W, HEADER_H } from "@/lib/treeLayout";
import type { MiniMapData } from "@/lib/minimapQuery";
import type { Tier } from "@/lib/types";

// Tier hues echo the movement-map style: each tier its own color family.
const TIER_FILL: Record<Tier, string> = {
  PURPOSE: "#f59e0b",
  ROOT_ISSUE: "#f43f5e",
  GOAL: "#38bdf8",
  STRATEGY: "#34d399",
  TACTIC: "#a78bfa",
  ACTION: "#f472b6",
};

const MAP_W = 208;
const MAP_MAX_H = 170;

/**
 * Floating goal-tree minimap pinned to the upper right of forum pages.
 * Stays in place while scrolling; collapses to a small button. Clicking a
 * node deep-links into the tree view with that node's panel open.
 */
export default function TreeMiniMap({
  boardSlug,
  data,
}: {
  boardSlug: string;
  data: MiniMapData;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  // Default open on wide screens; remember the user's last choice.
  useEffect(() => {
    const saved = window.localStorage.getItem("lioness.minimap");
    if (saved !== null) setCollapsed(saved === "closed");
    else setCollapsed(window.innerWidth < 1280);
  }, []);
  function toggle() {
    setCollapsed((c) => {
      window.localStorage.setItem("lioness.minimap", c ? "open" : "closed");
      return !c;
    });
  }

  const { layout, meta } = data;
  if (layout.instances.length === 0) return null;

  const contentH = layout.height - HEADER_H;
  const scale = Math.min(MAP_W / layout.width, MAP_MAX_H / contentH);
  const w = Math.ceil(layout.width * scale);
  const h = Math.ceil(contentH * scale);
  const sx = (x: number) => x * scale;
  const sy = (y: number) => (y - HEADER_H) * scale;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Show goal-tree minimap"
        className="fixed right-4 top-16 z-30 hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted shadow-md hover:border-accent hover:text-accent md:flex"
      >
        <MiniGlyph />
        Tree map
      </button>
    );
  }

  const hoveredTitle = hovered ? meta[hovered]?.title : null;

  return (
    <div className="fixed right-4 top-16 z-30 hidden w-56 rounded-lg border border-line bg-surface shadow-lg md:block">
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Goal tree
        </span>
        <button
          type="button"
          onClick={() => router.push(`/b/${boardSlug}/tree`)}
          className="ml-auto text-[11px] text-accent hover:underline"
        >
          Open ⤢
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse minimap"
          className="leading-none text-muted hover:text-foreground"
        >
          −
        </button>
      </div>
      <div className="p-2.5">
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="block cursor-pointer"
          onClick={() => router.push(`/b/${boardSlug}/tree`)}
        >
          {layout.edges.map((e) => (
            <line
              key={e.key}
              x1={sx(e.x1)}
              y1={sy(e.y1)}
              x2={sx(e.x2)}
              y2={sy(e.y2)}
              stroke="#e0dcd7"
              strokeWidth={0.75}
            />
          ))}
          {layout.instances.map((inst) => {
            const m = meta[inst.nodeId];
            if (!m) return null;
            const isStub = m.status === "STUB";
            const fill = isStub
              ? "#d6d3d1"
              : (TIER_FILL[m.tier as Tier] ?? "#a8a29e");
            // A stub block represents a parent's overflow candidate pool;
            // clicking it opens that parent in the tree view.
            const target = isStub ? inst.nodeId.slice(5) : inst.nodeId;
            return (
              <rect
                key={inst.key}
                x={sx(inst.x)}
                y={sy(inst.y)}
                width={Math.max(4, CARD_W * scale)}
                height={Math.max(2.5, CARD_H * scale)}
                rx={1.5}
                fill={fill}
                fillOpacity={
                  isStub ? 0.6 : m.status === "PROPOSED" ? 0.45 : 0.95
                }
                stroke={m.status === "CONTESTED" ? "#dc2626" : "none"}
                strokeWidth={1}
                onClick={(ev) => {
                  ev.stopPropagation();
                  router.push(`/b/${boardSlug}/tree?node=${target}`);
                }}
                onMouseEnter={() => setHovered(inst.nodeId)}
                onMouseLeave={() =>
                  setHovered((cur) => (cur === inst.nodeId ? null : cur))
                }
              />
            );
          })}
        </svg>
        <div className="mt-1.5 h-7 overflow-hidden text-[11px] leading-tight text-muted">
          {hoveredTitle ?? "Click a node to open it in the tree."}
        </div>
      </div>
    </div>
  );
}

function MiniGlyph() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
      <rect x="0" y="4.5" width="3.5" height="3" rx="0.75" fill="#f59e0b" />
      <rect x="5.25" y="0.5" width="3.5" height="3" rx="0.75" fill="#38bdf8" />
      <rect x="5.25" y="8.5" width="3.5" height="3" rx="0.75" fill="#38bdf8" />
      <rect x="10.5" y="4.5" width="3.5" height="3" rx="0.75" fill="#34d399" />
      <path
        d="M3.5 6 L5.25 2 M3.5 6 L5.25 10 M8.75 2 L10.5 6 M8.75 10 L10.5 6"
        stroke="#d6d3d1"
        strokeWidth="0.75"
        fill="none"
      />
    </svg>
  );
}
