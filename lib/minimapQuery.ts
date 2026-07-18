import { prisma } from "@/lib/db";
import { getScores } from "@/lib/scores";
import { layoutTree, type TreeLayout } from "@/lib/treeLayout";

export interface MiniMapNodeMeta {
  tier: string;
  status: string;
  title: string;
}

export interface MiniMapData {
  layout: TreeLayout;
  meta: Record<string, MiniMapNodeMeta>;
}

/**
 * Lightweight tree layout for the floating minimap shown on forum pages.
 * Shows the working plan — the same vote-ranked top-N per parent as the tree
 * view — with overflow pools drawn as a single muted stub block.
 */
export async function getMiniMapData(boardId: string): Promise<MiniMapData> {
  const [board, nodes] = await Promise.all([
    prisma.board.findUniqueOrThrow({
      where: { id: boardId },
      select: { slotsPerParent: true },
    }),
    prisma.treeNode.findMany({
      where: { boardId, status: { not: "ARCHIVED" } },
      include: {
        parentLinks: { include: { parentNode: { select: { status: true } } } },
        childLinks: {
          include: {
            childNode: {
              select: {
                id: true,
                title: true,
                tier: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
  ]);
  const scores = await getScores(
    "NODE",
    nodes.map((n) => n.id)
  );

  const meta: Record<string, MiniMapNodeMeta> = {};
  const stubNodes: {
    id: string;
    tier: string;
    parentCount: number;
    childIds: string[];
  }[] = [];

  const layoutInput = nodes.map((n) => {
    meta[n.id] = { tier: n.tier, status: n.status, title: n.title };
    const ranked = n.childLinks
      .map((l) => l.childNode)
      .filter((c) => c.status !== "ARCHIVED")
      .sort((a, b) => {
        const sa = scores.get(a.id)?.score ?? 0;
        const sb = scores.get(b.id)?.score ?? 0;
        return (
          sb - sa ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.title.localeCompare(b.title)
        );
      });
    const visible = ranked.slice(0, board.slotsPerParent);
    const hidden = ranked.slice(board.slotsPerParent);
    const childIds = visible.map((c) => c.id);
    if (hidden.length > 0) {
      const stubId = `stub:${n.id}`;
      meta[stubId] = {
        tier: "STUB",
        status: "STUB",
        title: `${hidden.length} more candidate${hidden.length === 1 ? "" : "s"} under "${n.title}"`,
      };
      stubNodes.push({
        id: stubId,
        tier: hidden[0].tier,
        parentCount: 1,
        childIds: [],
      });
      childIds.push(stubId);
    }
    return {
      id: n.id,
      tier: n.tier,
      parentCount: n.parentLinks.filter(
        (l) => l.parentNode.status !== "ARCHIVED"
      ).length,
      childIds,
    };
  });

  return { layout: layoutTree([...layoutInput, ...stubNodes]), meta };
}
