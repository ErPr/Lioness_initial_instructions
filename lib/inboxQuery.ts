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
  // A user's inbox shows the canonical items they contributed to: ones they
  // shared first, plus ones they re-shared (their copy folded into someone
  // else's canonical via dedupeOf). Collect both, dedupe by canonical id.
  const [own, reshares] = await Promise.all([
    prisma.capturedItem.findMany({
      where: { userId, dedupeOf: null, status: { not: "rejected" } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.capturedItem.findMany({
      where: { userId, dedupeOf: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { dedupeOf: true },
    }),
  ]);

  const canonicalIds = [
    ...new Set(reshares.map((r) => r.dedupeOf!).filter(Boolean)),
  ];
  const ownIds = new Set(own.map((i) => i.id));
  const extraIds = canonicalIds.filter((id) => !ownIds.has(id));
  const extra = extraIds.length
    ? await prisma.capturedItem.findMany({
        where: { id: { in: extraIds }, status: { not: "rejected" } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const items = [...own, ...extra].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

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
