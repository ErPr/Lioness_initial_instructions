import { prisma } from "@/lib/db";

// Phase 5 — attention heat. Where is the collective mind pointing right now?
// Each captured item that has been routed or confirmed onto a node is a unit of
// attention; we weight by shareCount (many people sharing the same thing burns
// hotter) and decay by age, so the map shows *current* focus, not all-time.

const WINDOW_DAYS = 7;
const HALF_LIFE_DAYS = 3; // a share's weight halves every ~3 days
const CONFIRMED_BONUS = 1.4; // a placed item counts a bit more than a pending one

export interface NodeHeat {
  score: number; // decayed, shareCount-weighted attention
  count: number; // distinct captured items in the window
  shares: number; // total shareCount across them
}

/**
 * Attention heat per node from captured items (routed or confirmed) in the last
 * WINDOW_DAYS. Returns a map keyed by nodeId; nodes with no recent captures are
 * absent (treat as 0).
 */
export async function getNodeHeat(
  nodeIds?: string[],
  now: number = Date.now()
): Promise<Map<string, NodeHeat>> {
  const since = new Date(now - WINDOW_DAYS * 24 * 3600 * 1000);
  const items = await prisma.capturedItem.findMany({
    where: {
      nodeId: nodeIds ? { in: nodeIds } : { not: null },
      status: { in: ["routed", "confirmed"] },
      dedupeOf: null, // canonical only — re-shares already fold into shareCount
      createdAt: { gte: since },
    },
    select: { nodeId: true, shareCount: true, status: true, createdAt: true },
  });

  const map = new Map<string, NodeHeat>();
  for (const it of items) {
    if (!it.nodeId) continue;
    const ageDays = (now - it.createdAt.getTime()) / (24 * 3600 * 1000);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const bonus = it.status === "confirmed" ? CONFIRMED_BONUS : 1;
    const contribution = it.shareCount * decay * bonus;

    const prev = map.get(it.nodeId) ?? { score: 0, count: 0, shares: 0 };
    prev.score += contribution;
    prev.count += 1;
    prev.shares += it.shareCount;
    map.set(it.nodeId, prev);
  }
  return map;
}

/**
 * Bucket a raw heat score into 0..4 warmth levels for rendering, relative to the
 * hottest node in view so the scale is always meaningful. 0 = quiet.
 */
export function warmthLevel(score: number, max: number): number {
  if (score <= 0 || max <= 0) return 0;
  const r = score / max;
  if (r > 0.66) return 4;
  if (r > 0.4) return 3;
  if (r > 0.2) return 2;
  return 1;
}

export interface AttentionEntry {
  nodeId: string;
  title: string;
  tier: string;
  boardSlug: string;
  boardName: string;
  heat: NodeHeat;
  level: number;
}

/** Top-N hottest nodes, optionally scoped to one board. Powers the panel. */
export async function getTopAttention(
  opts: { boardId?: string; limit?: number; now?: number } = {}
): Promise<AttentionEntry[]> {
  const { boardId, limit = 5, now = Date.now() } = opts;
  const heat = await getNodeHeat(undefined, now);
  if (heat.size === 0) return [];

  const nodes = await prisma.treeNode.findMany({
    where: {
      id: { in: [...heat.keys()] },
      status: { not: "ARCHIVED" },
      ...(boardId ? { boardId } : {}),
    },
    select: {
      id: true,
      title: true,
      tier: true,
      board: { select: { slug: true, name: true } },
    },
  });

  const max = Math.max(...[...heat.values()].map((h) => h.score));
  const entries: AttentionEntry[] = nodes.map((n) => {
    const h = heat.get(n.id)!;
    return {
      nodeId: n.id,
      title: n.title,
      tier: n.tier,
      boardSlug: n.board.slug,
      boardName: n.board.name,
      heat: h,
      level: warmthLevel(h.score, max),
    };
  });
  entries.sort((a, b) => b.heat.score - a.heat.score);
  return entries.slice(0, limit);
}
