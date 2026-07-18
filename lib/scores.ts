import { prisma } from "@/lib/db";
import type { VoteTargetType } from "@/lib/types";

export interface ScoreInfo {
  score: number;
  myVote: number; // -1 | 0 | +1
}

/**
 * Batch-fetch vote scores (and the viewing user's own vote) for a set of
 * targets of one type. Returns a map keyed by targetId; missing ids score 0.
 */
export async function getScores(
  targetType: VoteTargetType,
  targetIds: string[],
  viewerUserId?: string | null
): Promise<Map<string, ScoreInfo>> {
  const map = new Map<string, ScoreInfo>();
  for (const id of targetIds) map.set(id, { score: 0, myVote: 0 });
  if (targetIds.length === 0) return map;

  const votes = await prisma.vote.findMany({
    where: { targetType, targetId: { in: targetIds } },
    select: { targetId: true, value: true, userId: true },
  });
  for (const v of votes) {
    const info = map.get(v.targetId)!;
    info.score += v.value;
    if (viewerUserId && v.userId === viewerUserId) info.myVote = v.value;
  }
  return map;
}

/**
 * Recent vote velocity: sum of votes cast in the last `days` days, used by
 * the News/Trending flyout tab. Separate query so the all-time score above
 * stays a single cheap aggregate.
 */
export async function getRecentVelocity(
  targetType: VoteTargetType,
  targetIds: string[],
  days = 7
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const id of targetIds) map.set(id, 0);
  if (targetIds.length === 0) return map;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const votes = await prisma.vote.findMany({
    where: { targetType, targetId: { in: targetIds }, createdAt: { gte: since } },
    select: { targetId: true, value: true },
  });
  for (const v of votes) map.set(v.targetId, (map.get(v.targetId) ?? 0) + v.value);
  return map;
}
