import { prisma } from "@/lib/db";

// Placement without a request scope, for seed scripts only. Mirrors the DB
// writes in confirmPlacement (Post + item update + audit) but skips
// requireUser/revalidate so it can run from a plain node process.
export async function confirmPlacementDirect(
  itemId: string,
  userId: string,
  nodeId: string,
  boardId: string,
  _boardSlug: string
) {
  const item = await prisma.capturedItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  const title = item.metaTitle || item.title || "Shared item";
  const body = [item.url, item.metaDescription].filter(Boolean).join("\n\n");

  const post = await prisma.post.create({
    data: {
      boardId,
      authorId: userId,
      title: title.slice(0, 200),
      body,
      contributionType: item.contributionType || "RESOURCE",
      treeNodeId: nodeId,
    },
  });
  await prisma.capturedItem.update({
    where: { id: itemId },
    data: { status: "confirmed", createdPostId: post.id, nodeId, boardId },
  });
  await prisma.nodeEditLog.create({
    data: {
      nodeId,
      userId,
      action: "LINK",
      detail: `Evidence added from a shared item: "${title.slice(0, 80)}"`,
    },
  });
}
