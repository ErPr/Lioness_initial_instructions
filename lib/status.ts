// Automatic node status: statuses are computed from votes, not assigned.
// (ARCHIVED is the one manual exception — it's a removal action, not a
// sentiment.) Thresholds are constants for the pilot; later they become
// per-board admin settings alongside slotsPerParent.

export const RATIFY_NET = 5; // net score that ratifies a node
export const CONTEST_MIN_DOWNVOTES = 3; // real opposition, not one grudge
export const CONTEST_DOWN_RATIO = 0.4; // ...and a meaningful share of votes

export type ComputedStatus = "PROPOSED" | "RATIFIED" | "CONTESTED";

export function computeNodeStatus(up: number, down: number): ComputedStatus {
  // Contested dominates: sustained opposition shows even on a net-positive
  // node (a divisive tactic shouldn't read as settled).
  if (
    down >= CONTEST_MIN_DOWNVOTES &&
    down / Math.max(1, up + down) >= CONTEST_DOWN_RATIO
  ) {
    return "CONTESTED";
  }
  if (up - down >= RATIFY_NET) return "RATIFIED";
  return "PROPOSED";
}
