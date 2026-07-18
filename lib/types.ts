// Enum-like values for SQLite (Prisma enums unsupported there).
// These are the single source of truth; API routes validate against them.

export const TIERS = [
  "PURPOSE",
  "ROOT_ISSUE",
  "GOAL",
  "STRATEGY",
  "TACTIC",
  "ACTION",
] as const;
export type Tier = (typeof TIERS)[number];

// Rank used for the "links flow from higher tier to equal-or-lower tier" rule
// and for ordering the tree view's column bands, left to right.
export const TIER_RANK: Record<Tier, number> = {
  PURPOSE: 0,
  ROOT_ISSUE: 1,
  GOAL: 2,
  STRATEGY: 3,
  TACTIC: 4,
  ACTION: 5,
};

export const TIER_LABELS: Record<Tier, string> = {
  PURPOSE: "Purpose",
  ROOT_ISSUE: "Root Issues",
  GOAL: "Goals",
  STRATEGY: "Strategies",
  TACTIC: "Tactics",
  ACTION: "Actions",
};

export const NODE_STATUSES = [
  "PROPOSED",
  "RATIFIED",
  "CONTESTED",
  "ARCHIVED",
] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const CONTRIBUTION_TYPES = [
  "DISCUSSION",
  "PROBLEM",
  "SOLUTION",
  "STRATEGY",
  "TACTIC",
  "RESOURCE",
  "QUESTION",
] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const CONTRIBUTION_LABELS: Record<ContributionType, string> = {
  DISCUSSION: "Discussion",
  PROBLEM: "Problem",
  SOLUTION: "Solution",
  STRATEGY: "Strategy",
  TACTIC: "Tactic",
  RESOURCE: "Resource",
  QUESTION: "Question",
};

export const VOTE_TARGET_TYPES = ["POST", "COMMENT", "NODE"] as const;
export type VoteTargetType = (typeof VOTE_TARGET_TYPES)[number];

export function isTier(v: string): v is Tier {
  return (TIERS as readonly string[]).includes(v);
}
export function isNodeStatus(v: string): v is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(v);
}
export function isContributionType(v: string): v is ContributionType {
  return (CONTRIBUTION_TYPES as readonly string[]).includes(v);
}
export function isVoteTargetType(v: string): v is VoteTargetType {
  return (VOTE_TARGET_TYPES as readonly string[]).includes(v);
}
