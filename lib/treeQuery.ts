import { prisma } from "@/lib/db";
import { getScores, getRecentVelocity } from "@/lib/scores";
import { firstUrlDomain, timeAgo } from "@/lib/format";
import { layoutTree, type TreeLayout } from "@/lib/treeLayout";

// View-model types shared with the client tree components.

export interface FlyoutRow {
  targetType: "POST" | "COMMENT";
  id: string;
  title: string;
  subtitle: string;
  type: string; // contributionType
  score: number;
  myVote: number;
  href: string;
}

export interface NodeRef {
  id: string;
  title: string;
  tier: string;
}

export interface NodeView {
  id: string;
  title: string;
  summary: string;
  tier: string;
  status: string;
  score: number;
  myVote: number;
  attachedCount: number;
  parentCount: number;
  parents: NodeRef[];
  children: NodeRef[];
  topLinks: FlyoutRow[];
  support: FlyoutRow[];
  news: FlyoutRow[];
  editLog: { when: string; user: string; action: string; detail: string }[];
}

export interface TreeViewData {
  layout: TreeLayout;
  nodes: Record<string, NodeView>;
  /** all non-archived nodes, for link-management selects */
  allNodes: NodeRef[];
}

const SUPPORT_TYPES = new Set([
  "SOLUTION",
  "PROBLEM",
  "QUESTION",
  "DISCUSSION",
  "STRATEGY",
  "TACTIC",
]);

export async function getTreeViewData(
  boardId: string,
  boardSlug: string,
  viewerUserId?: string | null
): Promise<TreeViewData> {
  const nodes = await prisma.treeNode.findMany({
    where: { boardId, status: { not: "ARCHIVED" } },
    include: {
      parentLinks: { include: { parentNode: true } },
      childLinks: { include: { childNode: true } },
      posts: {
        where: { deletedAt: null },
        include: { author: { select: { username: true } } },
      },
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { username: true } } },
      },
      editLogs: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { username: true } } },
      },
    },
  });

  const nodeIds = nodes.map((n) => n.id);
  const postIds = nodes.flatMap((n) => n.posts.map((p) => p.id));
  const commentIds = nodes.flatMap((n) => n.comments.map((c) => c.id));

  const [nodeScores, postScores, commentScores, postVelocity, commentVelocity] =
    await Promise.all([
      getScores("NODE", nodeIds, viewerUserId),
      getScores("POST", postIds, viewerUserId),
      getScores("COMMENT", commentIds, viewerUserId),
      getRecentVelocity("POST", postIds),
      getRecentVelocity("COMMENT", commentIds),
    ]);

  const nodeViews: Record<string, NodeView> = {};
  for (const n of nodes) {
    const postRows = n.posts.map((p) => {
      const s = postScores.get(p.id) ?? { score: 0, myVote: 0 };
      return {
        row: {
          targetType: "POST" as const,
          id: p.id,
          title: p.title,
          subtitle:
            (firstUrlDomain(p.body) ? `${firstUrlDomain(p.body)} · ` : "") +
            `${p.author.username} · ${timeAgo(p.createdAt)}`,
          type: p.contributionType,
          score: s.score,
          myVote: s.myVote,
          href: `/b/${boardSlug}/post/${p.id}`,
        },
        contributionType: p.contributionType,
        createdAt: p.createdAt.getTime(),
        velocity: postVelocity.get(p.id) ?? 0,
      };
    });
    const commentRows = n.comments.map((c) => {
      const s = commentScores.get(c.id) ?? { score: 0, myVote: 0 };
      const excerpt = c.body.length > 90 ? c.body.slice(0, 90) + "…" : c.body;
      return {
        row: {
          targetType: "COMMENT" as const,
          id: c.id,
          title: excerpt,
          subtitle: `comment · ${c.author.username} · ${timeAgo(c.createdAt)}`,
          type: c.contributionType,
          score: s.score,
          myVote: s.myVote,
          href: `/b/${boardSlug}/post/${c.postId}`,
        },
        contributionType: c.contributionType,
        createdAt: c.createdAt.getTime(),
        velocity: commentVelocity.get(c.id) ?? 0,
      };
    });

    const all = [...postRows, ...commentRows];
    const byScore = (a: (typeof all)[number], b: (typeof all)[number]) =>
      b.row.score - a.row.score || b.createdAt - a.createdAt;

    const topLinks = postRows
      .filter((r) => r.contributionType === "RESOURCE")
      .sort(byScore)
      .map((r) => r.row);
    const support = all
      .filter((r) => SUPPORT_TYPES.has(r.contributionType))
      .sort(byScore)
      .map((r) => r.row);
    // News/Trending: recency + recent vote velocity instead of all-time score.
    const news = [...all]
      .sort(
        (a, b) => b.velocity - a.velocity || b.createdAt - a.createdAt
      )
      .map((r) => r.row);

    const ns = nodeScores.get(n.id) ?? { score: 0, myVote: 0 };
    nodeViews[n.id] = {
      id: n.id,
      title: n.title,
      summary: n.summary,
      tier: n.tier,
      status: n.status,
      score: ns.score,
      myVote: ns.myVote,
      attachedCount: all.length,
      parentCount: n.parentLinks.length,
      parents: n.parentLinks.map((l) => ({
        id: l.parentNode.id,
        title: l.parentNode.title,
        tier: l.parentNode.tier,
      })),
      children: n.childLinks.map((l) => ({
        id: l.childNode.id,
        title: l.childNode.title,
        tier: l.childNode.tier,
      })),
      topLinks,
      support,
      news,
      editLog: n.editLogs.map((e) => ({
        when: timeAgo(e.createdAt),
        user: e.user.username,
        action: e.action,
        detail: e.detail,
      })),
    };
  }

  // Display order for children: vote score desc, then title.
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
        .sort((a, b) => {
          const sa = nodeScores.get(a.id)?.score ?? 0;
          const sb = nodeScores.get(b.id)?.score ?? 0;
          return sb - sa || a.title.localeCompare(b.title);
        })
        .map((c) => c.id),
    }))
  );

  return {
    layout,
    nodes: nodeViews,
    allNodes: nodes
      .map((n) => ({ id: n.id, title: n.title, tier: n.tier }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  };
}
