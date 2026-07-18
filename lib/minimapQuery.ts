import { prisma } from "@/lib/db";
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
 * Same layout engine as the full tree view, none of the flyout data.
 */
export async function getMiniMapData(boardId: string): Promise<MiniMapData> {
  const nodes = await prisma.treeNode.findMany({
    where: { boardId, status: { not: "ARCHIVED" } },
    include: {
      parentLinks: { include: { parentNode: { select: { status: true } } } },
      childLinks: {
        include: {
          childNode: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });

  const layout = layoutTree(
    nodes.map((n) => ({
      id: n.id,
      tier: n.tier,
      parentCount: n.parentLinks.filter(
        (l) => l.parentNode.status !== "ARCHIVED"
      ).length,
      childIds: n.childLinks
        .map((l) => l.childNode)
        .filter((c) => c.status !== "ARCHIVED")
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((c) => c.id),
    }))
  );

  return {
    layout,
    meta: Object.fromEntries(
      nodes.map((n) => [
        n.id,
        { tier: n.tier, status: n.status, title: n.title },
      ])
    ),
  };
}
