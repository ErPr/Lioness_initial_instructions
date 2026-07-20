# Lioness — Product Brief

*Paste this into any conversation to bring it up to speed on the project.*

## What it is

Lioness is a discussion platform for political and civic movements where the
forum and a visual **goal tree** are two views of the same data. Every post
and comment carries structure — a contribution type (problem / solution /
strategy / tactic / resource / question / discussion) and an optional
attachment to a node in the movement's tree — so the community's conversation
can be rendered either chronologically (like Reddit) or as a living roadmap:
Purpose on the left, branching right into Goals → Strategies → Tactics.

One-line pitch: **Reddit shows you what a community said; Lioness shows you
what it decided.**

## How it works (the mechanics that matter)

- **The tree is a DAG, not a strict tree.** One tactic can serve several
  strategies (e.g. "Constitutional Convention" under two amendment routes).
  A node's parent count is its leverage score. Shared nodes render as
  repeated cards with an "appears in N places" badge.
- **The working plan is vote-driven.** Each branch shows only its top-3
  children by community vote; the rest wait in ranked candidate pools
  ("+N candidates"). Outvote a seated idea and you swap onto the board
  automatically. Slot count is a per-board setting.
- **Statuses are automatic.** Net +5 votes ratifies a node; 3+ downvotes
  making up 40% of votes marks it contested (divisive ideas can't read as
  settled); everything else is proposed. No moderators assign status.
- **Every tree edit is logged** (create, retier, link, unlink, auto-status
  transitions). Any member can edit during the pilot; accountability comes
  from the audit log.

## Current state

A working self-hosted prototype (Next.js + TypeScript, SQLite/Prisma,
Tailwind, cookie auth; zero external services). Implemented: boards, typed
posts/threaded comments, voting on posts/comments/nodes, the full tree view
with tier bands + flyout (Top Links / Support / News tabs) + editing side
panel with branch leaderboards, a floating tree minimap on forum pages, dark
mode, and a seed of **10 real movement boards** (Money Out of Politics fully
built as the flagship demo). A shareable interactive demo exists as a Claude
artifact.

## Deliberately deferred (the roadmap)

- **AI layer**: classify/attach posts automatically, draft trees from raw
  discussion, dedupe ideas, brief newcomers.
- **Cross-board coalition graph**: detect when movements share tactics
  (schema already supports it — plain-text nodes, many-to-many links).
- Roles ("established leaders"), per-board thresholds, notifications,
  moderation beyond author-delete, external news ingestion.

## Business context (early, undecided)

Solo non-technical founder building via AI pair-programming; pilot stage,
pre-revenue, pre-incorporation. Open questions: who pays (advocacy-org SaaS,
hosted network, grants, B2B structured deliberation?); wedge market; whether
this is a YC-shaped venture or a civic-tech nonprofit. The 10 pilot boards
are deliberately cross-partisan accountability/reform causes.
