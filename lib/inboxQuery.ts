import { prisma } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export interface AiCandidate {
  boardId: string;
  boardSlug?: string;
  boardName?: string;
  nodeId: string;
  nodeTitle?: string;
  nodeTier?: string;
  contributionType: string;
  confidence: number;
}

export interface InboxItemView {
  id: string;
  status: string;
  url: string | null;
  title: string | null;
  displayTitle: string;
  domain: string | null;
  hasImage: boolean;
  when: string;
  shareCount: number;
  aiSource: string | null;
  candidates: AiCandidate[];
  top: AiCandidate | null;
  createdPostId: string | null;
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function getInboxItems(userId: string): Promise<InboxItemView[]> {
  // Canonical items only (re-shares fold into their canonical via dedupeOf).
  const items = await prisma.capturedItem.findMany({
    where: { userId, dedupeOf: null, status: { not: "rejected" } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve candidate node/board names for display.
  const candidateNodeIds = new Set<string>();
  const parsed = items.map((it) => {
    let candidates: AiCandidate[] = [];
    if (it.aiCandidates) {
      try {
        candidates = JSON.parse(it.aiCandidates) as AiCandidate[];
      } catch {
        candidates = [];
      }
    }
    for (const c of candidates) candidateNodeIds.add(c.nodeId);
    return { it, candidates };
  });

  const nodes = await prisma.treeNode.findMany({
    where: { id: { in: [...candidateNodeIds] } },
    select: {
      id: true,
      title: true,
      tier: true,
      board: { select: { slug: true, name: true } },
    },
  });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return parsed.map(({ it, candidates }) => {
    const enriched = candidates.map((c) => {
      const n = nodeMap.get(c.nodeId);
      return {
        ...c,
        boardSlug: n?.board.slug,
        boardName: n?.board.name,
        nodeTitle: n?.title,
        nodeTier: n?.tier,
      };
    });
    const displayTitle =
      it.metaTitle ||
      it.title ||
      (it.rawText && it.rawText.slice(0, 100)) ||
      it.url ||
      (it.imagePath ? "Shared screenshot" : "Shared item");
    return {
      id: it.id,
      status: it.status,
      url: it.url,
      title: it.title,
      displayTitle,
      domain: domainOf(it.url),
      hasImage: !!it.imagePath,
      when: timeAgo(it.createdAt),
      shareCount: it.shareCount,
      aiSource: it.aiSource,
      candidates: enriched,
      top: enriched[0] ?? null,
      createdPostId: it.createdPostId,
    };
  });
}

export async function pendingCount(userId: string): Promise<number> {
  return prisma.capturedItem.count({
    where: {
      userId,
      dedupeOf: null,
      status: { in: ["pending", "enriched", "routed"] },
    },
  });
}
