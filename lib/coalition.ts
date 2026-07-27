import { prisma } from "@/lib/db";

// The Coalition Engine core: find nodes in DIFFERENT movements that describe
// the same or complementary effort. v1 uses TF-IDF cosine similarity over
// node titles+summaries (zero external services); an optional Claude pass
// (lib/ai.ts) refines the top candidates when an API key is configured.

export interface BridgeNode {
  id: string;
  title: string;
  tier: string;
  boardId: string;
  boardSlug: string;
  boardName: string;
}

export interface Bridge {
  a: BridgeNode;
  b: BridgeNode;
  score: number; // cosine similarity 0..1
  ai?: { verdict: string; rationale: string } | null;
}

export interface Alliance {
  boards: [
    { id: string; slug: string; name: string },
    { id: string; slug: string; name: string },
  ];
  score: number;
  bridges: Bridge[];
}

export interface CoalitionData {
  bridges: Bridge[];
  alliances: Alliance[];
  nodeCount: number;
  computedAt: number;
}

const STOP = new Set(
  `a an and are as at be by for from has have in into is it its of on or that the their them they this to was were will with we our your not no all every any out up down over under more most across against\nend ban pass stop make keep get win build push protect defend restore expand require`.split(
    /\s+/
  )
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    // crude plural/suffix normalization so "commissions" ≈ "commission"
    .map((t) => t.replace(/(ies)$/, "y").replace(/(s|es)$/, ""));
}

const SIM_THRESHOLD = 0.32;
const MAX_BRIDGES = 120;
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { data: CoalitionData; at: number } | null = null;

export async function getCoalitionData(): Promise<CoalitionData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const nodes = await prisma.treeNode.findMany({
    where: { status: { not: "ARCHIVED" } },
    include: { board: { select: { id: true, slug: true, name: true } } },
  });

  // TF-IDF vectors.
  const docs = nodes.map((n) => tokenize(`${n.title} ${n.summary}`));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = docs.length;
  const vectors: Map<string, number>[] = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    let norm = 0;
    for (const [t, f] of tf) {
      const idf = Math.log(N / (1 + (df.get(t) ?? 0)));
      if (idf <= 0) continue;
      const w = f * idf;
      vec.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of vec) vec.set(t, w / norm);
    return vec;
  });

  // Inverted index so we only score pairs that share at least one term.
  const byTerm = new Map<string, number[]>();
  vectors.forEach((vec, i) => {
    for (const t of vec.keys()) {
      if (!byTerm.has(t)) byTerm.set(t, []);
      byTerm.get(t)!.push(i);
    }
  });
  const dot = new Map<string, number>(); // "i:j" i<j, cross-board only
  for (const [term, idxs] of byTerm) {
    if (idxs.length > 60) continue; // ubiquitous term → no signal, skip
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const i = idxs[x], j = idxs[y];
        if (nodes[i].boardId === nodes[j].boardId) continue;
        const key = `${i}:${j}`;
        dot.set(
          key,
          (dot.get(key) ?? 0) + vectors[i].get(term)! * vectors[j].get(term)!
        );
      }
    }
  }

  const toBridgeNode = (i: number): BridgeNode => ({
    id: nodes[i].id,
    title: nodes[i].title,
    tier: nodes[i].tier,
    boardId: nodes[i].board.id,
    boardSlug: nodes[i].board.slug,
    boardName: nodes[i].board.name,
  });

  const bridges: Bridge[] = [...dot.entries()]
    .filter(([, score]) => score >= SIM_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_BRIDGES)
    .map(([key, score]) => {
      const [i, j] = key.split(":").map(Number);
      return { a: toBridgeNode(i), b: toBridgeNode(j), score };
    });

  // Aggregate into board-pair alliances.
  const allianceMap = new Map<string, Alliance>();
  for (const br of bridges) {
    const [x, y] =
      br.a.boardId < br.b.boardId ? [br.a, br.b] : [br.b, br.a];
    const key = `${x.boardId}|${y.boardId}`;
    if (!allianceMap.has(key)) {
      allianceMap.set(key, {
        boards: [
          { id: x.boardId, slug: x.boardSlug, name: x.boardName },
          { id: y.boardId, slug: y.boardSlug, name: y.boardName },
        ],
        score: 0,
        bridges: [],
      });
    }
    const al = allianceMap.get(key)!;
    al.score += br.score;
    al.bridges.push(br);
  }
  const alliances = [...allianceMap.values()].sort((a, b) => b.score - a.score);

  const data: CoalitionData = {
    bridges,
    alliances,
    nodeCount: nodes.length,
    computedAt: Date.now(),
  };
  cache = { data, at: Date.now() };
  return data;
}

/** Top allied boards for one board, from the cached coalition data. */
export async function getAlliesForBoard(boardId: string, limit = 3) {
  const { alliances } = await getCoalitionData();
  return alliances
    .filter((a) => a.boards.some((b) => b.id === boardId))
    .slice(0, limit)
    .map((a) => ({
      other: a.boards.find((b) => b.id !== boardId)!,
      score: a.score,
      bridgeCount: a.bridges.length,
      topBridge: a.bridges[0],
    }));
}
