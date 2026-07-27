"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isContributionType } from "@/lib/types";

// Phase 4 — the confirm loop. A routed item is private until its owner taps
// Confirm; only then does it become a real, public Post attached to the chosen
// tree node — the exact same path a member uses to attach a link by hand, so
// voting, ratification, and contest all apply from that moment.

export type CaptureActionState = { error?: string; ok?: boolean };

/**
 * Turn a routed captured item into a Post on `nodeId`. The item may be a
 * canonical (dedupeOf null) or the user's own — we always place the canonical
 * so shareCount is preserved. Sets createdPostId + status=confirmed and writes
 * an audit-log entry.
 */
export async function confirmPlacement(
  itemId: string,
  nodeId: string,
  contributionType: string
): Promise<CaptureActionState> {
  const user = await requireUser();

  const item = await prisma.capturedItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found." };
  // The user must own this item, or own a re-share that folded into it.
  const owns =
    item.userId === user.id ||
    (await prisma.capturedItem.count({
      where: { dedupeOf: item.id, userId: user.id },
    })) > 0;
  if (!owns) return { error: "That isn't your item." };
  if (item.dedupeOf) return { error: "This is a re-share; confirm the original." };
  if (item.status === "confirmed") return { error: "Already placed." };
  if (item.status !== "routed") return { error: "This item isn't ready to place yet." };

  const type = contributionType.toUpperCase();
  if (!isContributionType(type)) return { error: "Invalid contribution type." };

  const node = await prisma.treeNode.findUnique({
    where: { id: nodeId },
    include: { board: { select: { id: true, slug: true } } },
  });
  if (!node) return { error: "That node no longer exists." };

  const title =
    item.metaTitle ||
    item.title ||
    (item.rawText ? item.rawText.slice(0, 120) : null) ||
    item.url ||
    "Shared item";
  // Body carries the URL (so the flyout shows the domain and it's clickable)
  // and any description the enricher found.
  const bodyParts: string[] = [];
  if (item.url) bodyParts.push(item.url);
  if (item.metaDescription) bodyParts.push(item.metaDescription);
  else if (item.rawText) bodyParts.push(item.rawText.slice(0, 500));
  const body = bodyParts.join("\n\n");

  const post = await prisma.post.create({
    data: {
      boardId: node.board.id,
      authorId: user.id,
      title: title.slice(0, 200),
      body,
      contributionType: type,
      treeNodeId: node.id,
    },
  });

  await prisma.capturedItem.update({
    where: { id: item.id },
    data: {
      status: "confirmed",
      createdPostId: post.id,
      boardId: node.board.id,
      nodeId: node.id,
      contributionType: type,
    },
  });

  await prisma.nodeEditLog.create({
    data: {
      nodeId: node.id,
      userId: user.id,
      action: "LINK",
      detail: `Evidence added from a shared item: "${title.slice(0, 80)}"`,
    },
  });

  revalidatePath("/inbox");
  revalidatePath(`/b/${node.board.slug}/tree`);
  revalidatePath(`/b/${node.board.slug}`);
  return { ok: true };
}

/** Dismiss a captured item without placing it. Owner-only; reversible only by re-sharing. */
export async function rejectItem(itemId: string): Promise<CaptureActionState> {
  const user = await requireUser();
  const item = await prisma.capturedItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found." };
  const owns =
    item.userId === user.id ||
    (await prisma.capturedItem.count({
      where: { dedupeOf: item.id, userId: user.id },
    })) > 0;
  if (!owns) return { error: "That isn't your item." };
  if (item.status === "confirmed") return { error: "Already placed — can't reject." };

  await prisma.capturedItem.update({
    where: { id: item.id },
    data: { status: "rejected" },
  });
  revalidatePath("/inbox");
  return { ok: true };
}
