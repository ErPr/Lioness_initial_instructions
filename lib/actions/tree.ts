"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  isNodeStatus,
  isTier,
  TIER_RANK,
  type Tier,
} from "@/lib/types";

export type TreeActionResult = { error?: string; nodeId?: string };

async function logEdit(
  nodeId: string,
  userId: string,
  action: string,
  detail: string
) {
  await prisma.nodeEditLog.create({ data: { nodeId, userId, action, detail } });
}

/** Would adding parent -> child create a cycle? (BFS down from child) */
async function wouldCycle(
  boardId: string,
  parentNodeId: string,
  childNodeId: string
): Promise<boolean> {
  if (parentNodeId === childNodeId) return true;
  const links = await prisma.nodeLink.findMany({
    where: { parentNode: { boardId } },
    select: { parentNodeId: true, childNodeId: true },
  });
  const children = new Map<string, string[]>();
  for (const l of links) {
    (children.get(l.parentNodeId) ?? children.set(l.parentNodeId, []).get(l.parentNodeId)!).push(
      l.childNodeId
    );
  }
  const queue = [childNodeId];
  const seen = new Set<string>(queue);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === parentNodeId) return true;
    for (const next of children.get(cur) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/** Links must flow from a higher tier to an equal-or-lower tier. */
function tierFlowError(parentTier: string, childTier: string): string | null {
  if (TIER_RANK[parentTier as Tier] > TIER_RANK[childTier as Tier]) {
    return `A ${parentTier.toLowerCase()} can't be the parent of a higher-tier ${childTier.toLowerCase()} node.`;
  }
  return null;
}

export async function createNode(input: {
  boardId: string;
  tier: string;
  title: string;
  summary?: string;
  parentNodeId?: string | null;
  revalidate?: string;
}): Promise<TreeActionResult> {
  const user = await requireUser();
  const { boardId, tier, parentNodeId } = input;
  const title = input.title.trim();
  const summary = (input.summary ?? "").trim();

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { error: "Board not found." };
  if (!isTier(tier)) return { error: "Invalid tier." };
  if (title.length < 3) return { error: "Title must be at least 3 characters." };

  if (tier === "PURPOSE") {
    const existingRoot = await prisma.treeNode.findFirst({
      where: { boardId, tier: "PURPOSE" },
    });
    if (existingRoot) {
      return { error: "This board already has its one Purpose root node." };
    }
    if (parentNodeId) return { error: "The Purpose root cannot have a parent." };
  }

  let parent = null;
  if (parentNodeId) {
    parent = await prisma.treeNode.findUnique({ where: { id: parentNodeId } });
    if (!parent || parent.boardId !== boardId) {
      return { error: "Parent node not found on this board." };
    }
    const flowErr = tierFlowError(parent.tier, tier);
    if (flowErr) return { error: flowErr };
  }

  const node = await prisma.treeNode.create({
    data: { boardId, tier, title, summary, createdByUserId: user.id },
  });
  await logEdit(node.id, user.id, "CREATE", `Created as ${tier}: "${title}"`);

  if (parent) {
    await prisma.nodeLink.create({
      data: {
        parentNodeId: parent.id,
        childNodeId: node.id,
        createdByUserId: user.id,
      },
    });
    await logEdit(node.id, user.id, "LINK", `Linked under "${parent.title}"`);
  }

  if (input.revalidate) revalidatePath(input.revalidate);
  return { nodeId: node.id };
}

export async function updateNode(input: {
  nodeId: string;
  title?: string;
  summary?: string;
  tier?: string;
  status?: string;
  revalidate?: string;
}): Promise<TreeActionResult> {
  const user = await requireUser();
  const node = await prisma.treeNode.findUnique({
    where: { id: input.nodeId },
    include: {
      parentLinks: { include: { parentNode: true } },
      childLinks: { include: { childNode: true } },
    },
  });
  if (!node) return { error: "Node not found." };

  const data: { title?: string; summary?: string; tier?: string; status?: string } =
    {};
  const changes: string[] = [];

  if (input.title !== undefined && input.title.trim() !== node.title) {
    const title = input.title.trim();
    if (title.length < 3) return { error: "Title must be at least 3 characters." };
    data.title = title;
    changes.push(`title "${node.title}" → "${title}"`);
  }
  if (input.summary !== undefined && input.summary.trim() !== node.summary) {
    data.summary = input.summary.trim();
    changes.push("summary updated");
  }

  if (input.tier !== undefined && input.tier !== node.tier) {
    const tier = input.tier;
    if (!isTier(tier)) return { error: "Invalid tier." };
    if (node.tier === "PURPOSE") {
      return { error: "The Purpose root keeps its tier — edit its title instead." };
    }
    if (tier === "PURPOSE") {
      return { error: "A board has exactly one Purpose node." };
    }
    // Re-tiering is cheap, but must not invert an existing link's direction.
    for (const l of node.parentLinks) {
      const err = tierFlowError(l.parentNode.tier, tier);
      if (err) {
        return {
          error: `Can't move to ${tier}: parent "${l.parentNode.title}" is a lower tier. Unlink it first.`,
        };
      }
    }
    for (const l of node.childLinks) {
      const err = tierFlowError(tier, l.childNode.tier);
      if (err) {
        return {
          error: `Can't move to ${tier}: child "${l.childNode.title}" is a higher tier. Unlink it first.`,
        };
      }
    }
    data.tier = tier;
    changes.push(`tier ${node.tier} → ${tier}`);
  }

  if (input.status !== undefined && input.status !== node.status) {
    if (!isNodeStatus(input.status)) return { error: "Invalid status." };
    data.status = input.status;
    changes.push(`status ${node.status} → ${input.status}`);
  }

  if (Object.keys(data).length === 0) return { nodeId: node.id };

  await prisma.treeNode.update({ where: { id: node.id }, data });
  await logEdit(
    node.id,
    user.id,
    data.tier ? "RETIER" : data.status ? "STATUS" : "UPDATE",
    changes.join("; ")
  );
  if (input.revalidate) revalidatePath(input.revalidate);
  return { nodeId: node.id };
}

export async function linkNodes(input: {
  parentNodeId: string;
  childNodeId: string;
  revalidate?: string;
}): Promise<TreeActionResult> {
  const user = await requireUser();
  const [parent, child] = await Promise.all([
    prisma.treeNode.findUnique({ where: { id: input.parentNodeId } }),
    prisma.treeNode.findUnique({ where: { id: input.childNodeId } }),
  ]);
  if (!parent || !child) return { error: "Node not found." };
  if (parent.boardId !== child.boardId) {
    return { error: "Nodes must belong to the same board." };
  }
  if (child.tier === "PURPOSE") {
    return { error: "The Purpose root cannot have a parent." };
  }
  const flowErr = tierFlowError(parent.tier, child.tier);
  if (flowErr) return { error: flowErr };

  const existing = await prisma.nodeLink.findUnique({
    where: {
      parentNodeId_childNodeId: {
        parentNodeId: parent.id,
        childNodeId: child.id,
      },
    },
  });
  if (existing) return { error: "That link already exists." };

  if (await wouldCycle(parent.boardId, parent.id, child.id)) {
    return { error: "That link would create a cycle." };
  }

  await prisma.nodeLink.create({
    data: {
      parentNodeId: parent.id,
      childNodeId: child.id,
      createdByUserId: user.id,
    },
  });
  await logEdit(child.id, user.id, "LINK", `Linked under "${parent.title}"`);
  if (input.revalidate) revalidatePath(input.revalidate);
  return { nodeId: child.id };
}

export async function unlinkNodes(input: {
  parentNodeId: string;
  childNodeId: string;
  revalidate?: string;
}): Promise<TreeActionResult> {
  const user = await requireUser();
  const link = await prisma.nodeLink.findUnique({
    where: {
      parentNodeId_childNodeId: {
        parentNodeId: input.parentNodeId,
        childNodeId: input.childNodeId,
      },
    },
    include: { parentNode: true },
  });
  if (!link) return { error: "Link not found." };

  await prisma.nodeLink.delete({ where: { id: link.id } });
  await logEdit(
    input.childNodeId,
    user.id,
    "UNLINK",
    `Unlinked from "${link.parentNode.title}"`
  );
  if (input.revalidate) revalidatePath(input.revalidate);
  return { nodeId: input.childNodeId };
}
