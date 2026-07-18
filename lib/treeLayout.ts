import { TIER_RANK, type Tier } from "@/lib/types";

// Left-to-right layered layout over vertical tier bands.
//
// The graph is a DAG (multi-parent), but we render it as a tree by REPEATING
// shared nodes under each of their parents — no long crossing edges. Each
// rendered copy is an "instance"; all instances of a node open the same node.

export const CARD_W = 216;
export const CARD_H = 76;
export const COL_GAP = 72;
export const ROW_GAP = 18;
export const BAND_PAD = 24; // horizontal padding inside a column band
export const HEADER_H = 44;

export interface LayoutNodeInput {
  id: string;
  tier: string;
  /** child node ids, already sorted in desired display order */
  childIds: string[];
  parentCount: number;
}

export interface Instance {
  key: string; // unique per rendered copy
  nodeId: string;
  parentKey: string | null;
  col: number;
  x: number; // px, card left
  y: number; // px, card top
}

export interface Edge {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Band {
  tier: Tier;
  col: number;
  x: number; // band left edge
  w: number;
}

export interface TreeLayout {
  bands: Band[];
  instances: Instance[];
  edges: Edge[];
  width: number;
  height: number;
}

export function layoutTree(nodes: LayoutNodeInput[]): TreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Column bands: only tiers present on this board, in rank order.
  const tiersPresent = [...new Set(nodes.map((n) => n.tier))].sort(
    (a, b) => TIER_RANK[a as Tier] - TIER_RANK[b as Tier]
  ) as Tier[];
  const colOfTier = new Map<string, number>(tiersPresent.map((t, i) => [t, i]));

  const bandW = CARD_W + BAND_PAD * 2;
  const bands: Band[] = tiersPresent.map((tier, i) => ({
    tier,
    col: i,
    x: i * (bandW + COL_GAP),
    w: bandW,
  }));

  // Roots: the Purpose node plus any parentless nodes (still-unlinked drafts).
  const roots = nodes.filter(
    (n) => n.tier === "PURPOSE" || n.parentCount === 0
  );

  // DFS building instances. y is in row units first, converted to px later.
  // Leaves take the next free row; internal instances center on their children.
  const instances: Instance[] = [];
  let nextRow = 0;
  let keySeq = 0;

  function place(nodeId: string, parentKey: string | null): Instance | null {
    const node = byId.get(nodeId);
    if (!node) return null;
    const inst: Instance = {
      key: `i${keySeq++}`,
      nodeId,
      parentKey,
      col: colOfTier.get(node.tier) ?? 0,
      x: 0,
      y: 0,
    };
    instances.push(inst);

    const childRows: number[] = [];
    for (const childId of node.childIds) {
      const child = place(childId, inst.key);
      if (child) childRows.push(child.y);
    }
    inst.y = childRows.length
      ? (Math.min(...childRows) + Math.max(...childRows)) / 2
      : nextRow++;
    return inst;
  }

  for (const root of roots) place(root.id, null);

  // Convert rows to px.
  const rowH = CARD_H + ROW_GAP;
  for (const inst of instances) {
    inst.x = bands[inst.col].x + BAND_PAD;
    inst.y = HEADER_H + inst.y * rowH;
  }

  // Same-column overlap guard (possible with equal-tier links or centering):
  // sweep each column top-down and push cards apart to a minimum separation.
  const byCol = new Map<number, Instance[]>();
  for (const inst of instances) {
    if (!byCol.has(inst.col)) byCol.set(inst.col, []);
    byCol.get(inst.col)!.push(inst);
  }
  for (const colInstances of byCol.values()) {
    colInstances.sort((a, b) => a.y - b.y);
    for (let i = 1; i < colInstances.length; i++) {
      const minY = colInstances[i - 1].y + rowH;
      if (colInstances[i].y < minY) colInstances[i].y = minY;
    }
  }

  // Edges parent → child, from final positions.
  const instByKey = new Map(instances.map((i) => [i.key, i]));
  const edges: Edge[] = [];
  for (const inst of instances) {
    if (!inst.parentKey) continue;
    const parent = instByKey.get(inst.parentKey)!;
    edges.push({
      key: `e-${parent.key}-${inst.key}`,
      x1: parent.x + CARD_W,
      y1: parent.y + CARD_H / 2,
      x2: inst.x,
      y2: inst.y + CARD_H / 2,
    });
  }

  const width = bands.length
    ? bands[bands.length - 1].x + bands[bands.length - 1].w
    : 0;
  const height =
    Math.max(HEADER_H, ...instances.map((i) => i.y + CARD_H)) + ROW_GAP;

  return { bands, instances, edges, width, height };
}
