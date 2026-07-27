# The Cartographer — AI drafts the map, the community ratifies it

*Design doc for the `ai-cartographer` fork. Status: design complete, ready to
implement.*

## Thesis

Structuring discussion is the labor bottleneck of Lioness: people post
freely, but turning talk into tree nodes takes effort, so trees stay shallow
(the atlas import is Purpose + 3-4 strategies). The Cartographer is an AI
agent that reads unstructured discussion and continuously **proposes**
structure — new nodes, attachments, merges, re-tiers.

**The core rule: AI output is a citizen, not an oracle.** Everything the
Cartographer produces enters the exact same pipeline as human contributions —
PROPOSED nodes in candidate pools that earn board seats only through
community votes, attachments that authors can detach, merge suggestions that
someone must accept. The community stays sovereign; the AI just does the
clerical labor of mapping.

## What it does (v1 scope)

1. **Placement suggestions.** For every unattached post/comment: suggest the
   node it belongs to (or "none"). Surfaced as a one-click "attach here?"
   chip on the post for its author (or any member).
2. **Node drafting.** For a board section with accumulating discussion:
   propose 1-3 new nodes (tier, title, summary, suggested parent), each
   created as PROPOSED by the system user, linked into the parent's candidate
   pool, with a system post explaining which discussion it was distilled from
   (citations = links to the source posts).
3. **Duplicate detection.** Flag near-duplicate candidates in the same pool
   ("these two strategies read as the same idea") with a merge suggestion.
4. **Proposal promotion.** Posts flagged `proposesNode` get a drafted node
   the author can accept with one click — closing the existing gap where
   proposals sit as badges forever.

## Mechanics

- **System user** `cartographer` (flagged `isAgent` on User) authors all AI
  contributions; its edit-log entries are labeled, and its nodes render with
  a small ⚙ badge. Full transparency about what the AI did.
- **Runs**: a `npm run cartographer -- <board-slug>` CLI (tsx script) for the
  pilot; later a cron/queue. Each run: fetch board discussion since last run
  → one Claude call with the current tree + new discussion → structured JSON
  plan (attachments, drafts, merges) → apply as proposals → log a run
  summary post in the board.
- **Model**: Claude (Sonnet tier) with the tree serialized as indented text
  and posts as a numbered list; response as a strict JSON schema (tool use).
  Cost estimate at pilot scale: ~1-3¢ per board run.
- **Config**: `ANTHROPIC_API_KEY` in `.env`. Without a key the CLI exits
  with a friendly message; the app itself never requires it.

## Schema impact

Minimal: `User.isAgent Boolean @default(false)`; optional
`Post.suggestedNodeId` for placement chips (or store suggestions in a small
`Suggestion` table so they're dismissible). No changes to the tree invariants
— the Cartographer goes through the same server actions as humans, so cycle
prevention, tier flow, and logging all apply automatically.

## Guardrails

- Hard cap per run (e.g. ≤5 new nodes per board) so the AI can't flood pools.
- Never votes, never ratifies, never archives.
- Every artifact carries provenance (run id + source-post citations).
- A board setting can disable the Cartographer entirely.

## Demo script (once built)

Run on Money Out of Politics with its 13 seeded posts → the Cartographer
should propose attaching the unattached corporate-pledge post, draft a
"Corporate no-donation pledges" TACTIC from it (fulfilling the seeded
`proposesNode` flag), and deepen 1-2 thin branches — all visible as ⚙
proposals in candidate pools for the community to vote on.
