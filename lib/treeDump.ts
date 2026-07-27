import { prisma } from "@/lib/db";

// Compact snapshot of every board's tree for AI routing input: node id, title,
// tier, and parent titles. Cached briefly — trees change slowly relative to
// capture volume.

export interface DumpNode {
  id: string;
  title: string;
  tier: string;
  parents: string[];
}
export interface DumpBoard {
  boardId: string;
  slug: string;
  name: string;
  nodes: DumpNode[];
}

let cache: { data: DumpBoard[]; at: number } | null = null;
const TTL = 60 * 1000;

export async function getTreeDump(): Promise<DumpBoard[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const boards = await prisma.board.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      nodes: {
        where: { status: { not: "ARCHIVED" } },
        select: {
          id: true,
          title: true,
          tier: true,
          parentLinks: {
            select: { parentNode: { select: { title: true } } },
          },
        },
      },
    },
  });

  const data: DumpBoard[] = boards.map((b) => ({
    boardId: b.id,
    slug: b.slug,
    name: b.name,
    nodes: b.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      tier: n.tier,
      parents: n.parentLinks.map((l) => l.parentNode.title),
    })),
  }));
  cache = { data, at: Date.now() };
  return data;
}
