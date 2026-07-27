import { prisma } from "@/lib/db";

// Submission-activity aggregation for the triage heatmap. "Submissions" =
// posts + comments (member contributions). The heatmap directs scarce human
// attention to where activity is concentrated, rather than trying to automate
// collection at scale.

export interface HeatCell {
  count: number;
  boards: number; // distinct boards contributing to this cell
}

export interface HeatRow {
  category: string;
  cells: HeatCell[]; // one per week bucket, oldest → newest
  total: number;
}

export interface HotSpot {
  slug: string;
  name: string;
  category: string;
  recent: number; // submissions in the hot window
  prior: number; // submissions in the window before it
  surge: number; // recent / max(1, prior) — >1 means accelerating
  unattached: number; // recent posts not yet attached to a tree node
}

export interface HeatmapData {
  weeks: { label: string; startDaysAgo: number }[];
  rows: HeatRow[];
  max: number; // busiest single cell, for the color scale
  hotSpots: HotSpot[];
  totalSubmissions: number;
}

const WEEKS = 8;
const HOT_WINDOW_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export async function getHeatmapData(): Promise<HeatmapData> {
  const now = Date.now();
  const windowStart = new Date(now - WEEKS * 7 * DAY);

  const [posts, comments, boards] = await Promise.all([
    prisma.post.findMany({
      where: { deletedAt: null, createdAt: { gte: windowStart } },
      select: {
        createdAt: true,
        treeNodeId: true,
        board: { select: { slug: true, name: true, category: true } },
      },
    }),
    prisma.comment.findMany({
      where: { deletedAt: null, createdAt: { gte: windowStart } },
      select: {
        createdAt: true,
        post: { select: { board: { select: { slug: true, name: true, category: true } } } },
      },
    }),
    prisma.board.findMany({ select: { slug: true, name: true, category: true } }),
  ]);

  type Sub = {
    at: number;
    slug: string;
    name: string;
    category: string;
    isPost: boolean;
    attached: boolean;
  };
  const subs: Sub[] = [
    ...posts.map((p) => ({
      at: p.createdAt.getTime(),
      slug: p.board.slug,
      name: p.board.name,
      category: p.board.category || "Other",
      isPost: true,
      attached: !!p.treeNodeId,
    })),
    ...comments.map((c) => ({
      at: c.createdAt.getTime(),
      slug: c.post.board.slug,
      name: c.post.board.name,
      category: c.post.board.category || "Other",
      isPost: false,
      attached: true,
    })),
  ];

  // Week buckets, oldest first. weekOf(at) → 0..WEEKS-1.
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const startDaysAgo = (WEEKS - i) * 7;
    return { label: `${startDaysAgo}–${startDaysAgo - 7}d`, startDaysAgo };
  });
  const weekOf = (at: number) => {
    const daysAgo = (now - at) / DAY;
    const idx = WEEKS - 1 - Math.floor(daysAgo / 7);
    return Math.max(0, Math.min(WEEKS - 1, idx));
  };

  // Category × week matrix.
  const categories = [...new Set(boards.map((b) => b.category || "Other"))];
  const grid = new Map<string, HeatCell[]>();
  const cellBoards = new Map<string, Set<string>>(); // "cat|week" → slugs
  for (const cat of categories) {
    grid.set(
      cat,
      Array.from({ length: WEEKS }, () => ({ count: 0, boards: 0 }))
    );
  }
  for (const s of subs) {
    const w = weekOf(s.at);
    const cell = grid.get(s.category)?.[w];
    if (!cell) continue;
    cell.count++;
    const key = `${s.category}|${w}`;
    if (!cellBoards.has(key)) cellBoards.set(key, new Set());
    cellBoards.get(key)!.add(s.slug);
  }
  for (const [cat, cells] of grid) {
    cells.forEach((cell, w) => {
      cell.boards = cellBoards.get(`${cat}|${w}`)?.size ?? 0;
    });
  }

  const rows: HeatRow[] = [...grid.entries()]
    .map(([category, cells]) => ({
      category,
      cells,
      total: cells.reduce((n, c) => n + c.count, 0),
    }))
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.count)));

  // Hot spots: per-board recent vs. prior submission volume.
  const hotStart = now - HOT_WINDOW_DAYS * DAY;
  const priorStart = now - 2 * HOT_WINDOW_DAYS * DAY;
  const perBoard = new Map<
    string,
    { name: string; category: string; recent: number; prior: number; unattached: number }
  >();
  for (const b of boards) {
    perBoard.set(b.slug, {
      name: b.name,
      category: b.category || "Other",
      recent: 0,
      prior: 0,
      unattached: 0,
    });
  }
  for (const s of subs) {
    const rec = perBoard.get(s.slug);
    if (!rec) continue;
    if (s.at >= hotStart) {
      rec.recent++;
      if (s.isPost && !s.attached) rec.unattached++;
    } else if (s.at >= priorStart) {
      rec.prior++;
    }
  }
  const hotSpots: HotSpot[] = [...perBoard.entries()]
    .map(([slug, r]) => ({
      slug,
      name: r.name,
      category: r.category,
      recent: r.recent,
      prior: r.prior,
      surge: r.recent / Math.max(1, r.prior),
      unattached: r.unattached,
    }))
    .filter((h) => h.recent > 0)
    .sort((a, b) => b.recent - a.recent || b.surge - a.surge)
    .slice(0, 12);

  return {
    weeks,
    rows,
    max,
    hotSpots,
    totalSubmissions: subs.length,
  };
}
