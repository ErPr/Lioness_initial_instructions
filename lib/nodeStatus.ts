import { prisma } from "@/lib/db";
import { computeNodeStatus } from "@/lib/status";

/**
 * Re-derive a node's status from its votes and persist it if changed.
 * Called after every NODE vote mutation. Automatic transitions are written
 * to the edit log (attributed to the voter whose vote tipped it).
 */
export async function recomputeNodeStatus(nodeId: string, actorUserId: string) {
  const node = await prisma.treeNode.findUnique({ where: { id: nodeId } });
  if (!node || node.status === "ARCHIVED") return;

  const votes = await prisma.vote.findMany({
    where: { targetType: "NODE", targetId: nodeId },
    select: { value: true },
  });
  const up = votes.filter((v) => v.value > 0).length;
  const down = votes.filter((v) => v.value < 0).length;
  const next = computeNodeStatus(up, down);
  if (next === node.status) return;

  await prisma.treeNode.update({
    where: { id: nodeId },
    data: { status: next },
  });
  await prisma.nodeEditLog.create({
    data: {
      nodeId,
      userId: actorUserId,
      action: "STATUS",
      detail: `auto: ${node.status} → ${next} (▲${up} ▼${down})`,
    },
  });
}
