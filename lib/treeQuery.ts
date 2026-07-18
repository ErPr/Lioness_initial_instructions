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

/** A child in a parent's ranked pool. */
export interface ChildRank extends NodeRef {
  score: number;
  myVote: number;
  onBoard: boolean; // inside the parent's slot count → rendered on the tree
}

/** A "+N candidates" stub card rendered under a parent whose pool overflows. */
export interface StubInfo {
  parentNodeId: string;
  count: number;
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
  children: ChildRank[];
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
  /** stub cards keyed by their pseudo layout id ("stub:<parentId>") */
  stubs: Record<string, StubInfo>;
  slots: number;
  showAll: boolean;
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
  board: { id: string; slug: string; slotsPerParent: number },
  viewerUserId?: string | null,
  showAll = false
): Promise<TreeViewData> {
  const { id: boardId, slug: boardSlug, slotsPerParent: slots } = board;
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

  // The working-plan filter: each parent's children ranked by community vote
  // (score desc, then age — an established idea keeps its seat on ties, a
  // newcomer must beat it). Only the top `slots` render on the tree; the rest
  // wait in the candidate pool behind a "+N candidates" stub.
  const rankedChildren = new Map<string, ChildRank[]>();
  for (const n of nodes) {
    const kids = n.childLinks
      .map((l) => l.childNode)
      .filter((c) => c.status !== "ARCHIVED")
      .sort((a, b) => {
        const sa = nodeScores.get(a.id)?.score ?? 0;
        const sb = nodeScores.get(b.id)?.score ?? 0;
        return (
          sb - sa ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.title.localeCompare(b.title)
        );
      });
    rankedChildren.set(
      n.id,
      kids.map((c, i) => ({
        id: c.id,
        title: c.title,
        tier: c.tier,
        score: nodeScores.get(c.id)?.score ?? 0,
        myVote: nodeScores.get(c.id)?.myVote ?? 0,
        onBoard: showAll || i < slots,
      }))
    );
  }

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
      children: rankedChildren.get(n.id) ?? [],
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

  // Layout over the working plan: visible children plus a stub pseudo-node
  // per overflowing parent.
  const stubs: Record<string, StubInfo> = {};
  const layoutInput = nodes.map((n) => {
    const ranked = rankedChildren.get(n.id) ?? [];
    const visible = ranked.filter((c) => c.onBoard);
    const hidden = ranked.filter((c) => !c.onBoard);
    const childIds = visible.map((c) => c.id);
    if (hidden.length > 0) {
      const stubId = `stub:${n.id}`;
      stubs[stubId] = { parentNodeId: n.id, count: hidden.length };
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
  const stubNodes = Object.entries(stubs).map(([stubId, s]) => {
    const firstHidden = rankedChildren
      .get(s.parentNodeId)!
      .find((c) => !c.onBoard)!;
    return { id: stubId, tier: firstHidden.tier, parentCount: 1, childIds: [] };
  });
  const layout = layoutTree([...layoutInput, ...stubNodes]);

  return {
    layout,
    nodes: nodeViews,
    allNodes: nodes
      .map((n) => ({ id: n.id, title: n.title, tier: n.tier }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    stubs,
    slots,
    showAll,
  };
}
