# The Reality Loop — the plan scores itself against the world

*Design doc for the `ai-reality-loop` fork. Status: design complete, ready to
implement after the Cartographer (shares its agent plumbing).*

## Thesis

A goal tree that never touches reality is a wish list. The Reality Loop is an
AI agent that watches the outside world and attaches what happens to the
nodes it affects — so the tree becomes a live scoreboard of the movement
versus reality, and momentum becomes measured instead of asserted.

## What it does (v1 scope)

1. **Event attachment.** On a schedule, for each followed board: search
   configured sources (news search API, congress.gov bill status, court
   docket RSS where available) for developments relevant to the board's
   nodes. Each hit becomes a RESOURCE post authored by the system user
   `reality-loop`, attached to the matching node, with source link and date.
   (The original build doc anticipated exactly this: external news is just
   RESOURCE posts — zero schema change for the core loop.)
2. **Reality status.** A lightweight per-node signal separate from community
   status: `ADVANCING | STALLED | BLOCKED | ACHIEVED`, set by the agent with
   a one-line justification, rendered as a small glyph on tree cards (e.g. ↑
   ↔ ✕ ★). Community status (proposed/ratified/contested) stays vote-owned;
   reality status is evidence-owned. The two together are the product: "we
   ratified this tactic AND it's advancing."
3. **Measured momentum.** A board-level `liveMomentum` computed from recent
   event flow + platform activity, displayed beside the static atlas score
   and eventually replacing it for the hero pick and Explore leaderboard.

## Mechanics

- **Pipeline per run**: fetch external items → embed/match against node
  titles+summaries (same similarity core as the Coalition Engine) → Claude
  pass to verify relevance and classify impact → create posts + set reality
  status → run-summary post.
- **Sources v1**: a per-board list of RSS feeds and search queries stored in
  a `BoardSource` table, seeded from the atlas "Key Actors / Online Hubs"
  columns. No scraping beyond feeds/APIs; every event links out.
- **Dedup**: URL-hash unique index so the same article never posts twice.

## Schema impact

- `TreeNode.realityStatus String?` + `realityNote String?`
- `Board.liveMomentum Int @default(0)`
- `BoardSource { id, boardId, kind (RSS|QUERY), value }`
- `User.isAgent` (shared with the Cartographer fork)

## Guardrails

- Reality statuses always carry a citation; no citation, no status.
- Rate caps per board per run; boards can disable the agent.
- The agent never touches community statuses, votes, or the working plan.

## Demo script (once built)

Seed BoardSources for 3 boards (e.g. DISCLOSE Act query for Money Out of
Politics, right-to-repair bill feeds, solar deployment news). Run the loop;
show the DISCLOSE node gaining a dated committee-action post and an
ADVANCING glyph, and the board's liveMomentum ticking up on Explore.
