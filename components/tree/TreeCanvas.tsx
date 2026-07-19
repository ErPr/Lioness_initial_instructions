"use client";

import { useEffect, useRef, useState } from "react";
import NodeFlyout from "@/components/tree/NodeFlyout";
import NodePanel from "@/components/tree/NodePanel";
import { TIER_LABELS } from "@/lib/types";
import type { TreeViewData } from "@/lib/treeQuery";
import { CARD_H, CARD_W, HEADER_H, type Instance } from "@/lib/treeLayout";

const FLYOUT_W = 320;
const FLYOUT_MAX_H = 384;

const CARD_STATUS_CLS: Record<string, string> = {
  // proposed = muted, ratified = solid, contested = highlighted
  PROPOSED:
    "border-dashed border-stone-300 bg-white/70 text-stone-600 dark:border-stone-600 dark:bg-stone-900/50 dark:text-stone-400",
  RATIFIED:
    "border-solid border-amber-600/50 bg-white shadow-sm dark:border-amber-500/50 dark:bg-stone-900",
  CONTESTED:
    "border-solid border-red-400 bg-red-50 shadow-sm dark:border-red-500/60 dark:bg-red-950/40",
  ARCHIVED:
    "border-dotted border-stone-300 bg-stone-50 text-stone-400 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-500",
};

const BAR_STATUS_CLS: Record<string, string> = {
  PROPOSED: "bg-stone-300 dark:bg-stone-600",
  RATIFIED: "bg-amber-600 dark:bg-amber-500",
  CONTESTED: "bg-red-500",
  ARCHIVED: "bg-stone-200 dark:bg-stone-700",
};

export default function TreeCanvas({
  data,
  boardId,
  boardSlug,
  loggedIn,
  initialNodeId,
}: {
  data: TreeViewData;
  boardId: string;
  boardSlug: string;
  loggedIn: boolean;
  initialNodeId?: string;
}) {
  const { layout, nodes } = data;
  const [flyout, setFlyout] = useState<{ nodeId: string; inst: Instance } | null>(
    null
  );
  const [panelNodeId, setPanelNodeId] = useState<string | null>(
    initialNodeId && nodes[initialNodeId] ? initialNodeId : null
  );
  const canvasRef = useRef<HTMLDivElement>(null);

  // Flyout is transient: close on any click outside it and on Escape.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[data-flyout]") || t.closest("[data-node-card]")) return;
      setFlyout(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (flyout) setFlyout(null);
      else setPanelNodeId(null); // Escape with no flyout closes the panel
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [flyout]);

  function openFlyout(inst: Instance) {
    // Opening another node's flyout closes the previous one (state replace).
    setFlyout((f) =>
      f && f.inst.key === inst.key ? null : { nodeId: inst.nodeId, inst }
    );
  }

  function openPanel(nodeId: string) {
    setFlyout(null);
    setPanelNodeId(nodeId);
  }

  const panelNode = panelNodeId ? nodes[panelNodeId] : null;
  const flyoutNode = flyout ? nodes[flyout.nodeId] : null;

  const flyoutStyle: React.CSSProperties | null = flyout
    ? (() => {
        const rightEdge = flyout.inst.x + CARD_W + 10 + FLYOUT_W;
        const left =
          rightEdge <= layout.width + 40
            ? flyout.inst.x + CARD_W + 10
            : Math.max(0, flyout.inst.x - FLYOUT_W - 10);
        const top = Math.max(
          HEADER_H,
          Math.min(flyout.inst.y, layout.height - FLYOUT_MAX_H / 2)
        );
        return { left, top };
      })()
    : null;

  return (
    <div className="relative">
      <div className="overflow-auto rounded-lg border border-line bg-surface">
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: layout.width + 40,
            height: Math.max(layout.height + 20, 320),
            minWidth: "100%",
          }}
        >
          {/* Tier column bands with header labels */}
          {layout.bands.map((band, i) => (
            <div key={band.tier}>
              <div
                className={`absolute inset-y-0 ${i % 2 === 1 ? "bg-stone-50/80 dark:bg-stone-900/30" : ""}`}
                style={{ left: band.x, width: band.w }}
              />
              <div
                className="absolute flex items-center justify-center border-b border-line text-[11px] font-semibold uppercase tracking-widest text-muted"
                style={{ left: band.x, width: band.w, top: 0, height: HEADER_H - 12 }}
              >
                {TIER_LABELS[band.tier]}
              </div>
            </div>
          ))}

          {/* Connecting curves */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width + 40}
            height={Math.max(layout.height + 20, 320)}
          >
            {layout.edges.map((e) => {
              const dx = Math.max(36, (e.x2 - e.x1) / 2);
              return (
                <path
                  key={e.key}
                  d={`M ${e.x1} ${e.y1} C ${e.x1 + dx} ${e.y1}, ${e.x2 - dx} ${e.y2}, ${e.x2} ${e.y2}`}
                  fill="none"
                  style={{ stroke: "var(--edge)" }}
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>

          {/* Node cards (shared nodes render once per parent) */}
          {layout.instances.map((inst) => {
            const stub = data.stubs[inst.nodeId];
            if (stub) {
              // Overflow candidate pool for a parent: the ideas still
              // competing for a slot on the working plan.
              return (
                <button
                  key={inst.key}
                  type="button"
                  data-node-card
                  onClick={() => openPanel(stub.parentNodeId)}
                  className="absolute flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-stone-300 bg-stone-50/60 text-muted transition-colors hover:border-accent hover:text-accent dark:border-stone-600 dark:bg-stone-900/40"
                  style={{ left: inst.x, top: inst.y, width: CARD_W, height: CARD_H }}
                >
                  <span className="text-[13px] font-medium">
                    +{stub.count} candidate{stub.count === 1 ? "" : "s"}
                  </span>
                  <span className="text-[11px]">vote to promote →</span>
                </button>
              );
            }
            const node = nodes[inst.nodeId];
            if (!node) return null;
            const active =
              flyout?.inst.key === inst.key || panelNodeId === inst.nodeId;
            return (
              <div
                key={inst.key}
                data-node-card
                onClick={() => openFlyout(inst)}
                className={`absolute flex cursor-pointer overflow-hidden rounded-md border transition-shadow hover:shadow-md ${
                  CARD_STATUS_CLS[node.status] ?? CARD_STATUS_CLS.PROPOSED
                } ${active ? "ring-2 ring-accent/50" : ""}`}
                style={{ left: inst.x, top: inst.y, width: CARD_W, height: CARD_H }}
              >
                <div
                  className={`w-1 shrink-0 ${BAR_STATUS_CLS[node.status] ?? ""}`}
                />
                <div className="flex min-w-0 flex-1 flex-col justify-between p-2">
                  <div
                    className="line-clamp-2 text-[13px] font-medium leading-snug"
                    title={node.title}
                  >
                    {node.title}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span title="Vote score">▲ {node.score}</span>
                    <span title="Attached contributions">✎ {node.attachedCount}</span>
                    {node.parentCount > 1 && (
                      <span
                        title={`Appears in ${node.parentCount} places`}
                        className="rounded bg-accent-soft px-1 text-accent"
                      >
                        ×{node.parentCount}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Open node details"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFlyout(inst);
                      }}
                      className="ml-auto rounded border border-line px-1.5 leading-4 text-muted hover:border-accent hover:text-accent"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Flyout (one at a time, anchored to the clicked instance) */}
          {flyoutNode && flyoutStyle && (
            <NodeFlyout
              node={flyoutNode}
              boardSlug={boardSlug}
              loggedIn={loggedIn}
              style={flyoutStyle}
              onExpand={() => openPanel(flyoutNode.id)}
              onOpenNode={openPanel}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-stone-400 bg-white dark:border-stone-500 dark:bg-stone-900" />
          proposed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-600 dark:bg-amber-500" />
          ratified
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
          contested
        </span>
        <span>
          ×N = shared node, appears under N parents ·{" "}
          {data.showAll
            ? "showing every node, including candidates below the cutoff"
            : `top ${data.slots} per branch by votes make the board; “+N candidates” = ideas still competing`}
        </span>
      </div>

      {panelNode && (
        <NodePanel
          node={panelNode}
          boardId={boardId}
          boardSlug={boardSlug}
          allNodes={data.allNodes}
          slots={data.slots}
          loggedIn={loggedIn}
          onClose={() => setPanelNodeId(null)}
          onOpenNode={openPanel}
        />
      )}
    </div>
  );
}
