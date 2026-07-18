# Lioness

A discussion platform where every contribution is structured, so each
community's conversation can also be rendered as a visual **goal tree**: the
movement's purpose on the left, branching rightward into goals, strategies,
and tactics.

The core design principle: **the forum and the tree are two views of the same
data.** Every post and comment carries structural fields (contribution type,
tree node), so the tree page is just a different rendering of the records the
forum shows chronologically.

## Quick start

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db (SQLite)
npm run db:seed          # loads the ten pilot movement boards
npm run dev              # http://localhost:3000
```

Zero external services — SQLite file DB, cookie sessions, no OAuth.

All seed users have the password `lioness123` (e.g. `ava_quinn`, `marcus_w`,
`priya_s`), or register a fresh account.

## What's here (v1)

- **Boards** — one board = one movement, owning exactly one tree.
- **Forum** — posts and threaded comments, each carrying a `contributionType`
  (discussion / problem / solution / strategy / tactic / resource / question)
  and an optional tree-node attachment. Posts can instead *propose* a new node.
- **Tree view** (`/b/<slug>/tree`) — left-to-right SVG/HTML layout with
  vertical tier bands (Purpose | Goals | Strategies | Tactics). The structure
  is a DAG: a node can serve multiple parents, and shared nodes render as a
  repeated card under each parent with an "appears in N places" badge.
  Clicking a card opens a transient flyout (Top Links | Support |
  News/Trending — all views over the node's attached posts, votable inline);
  expanding promotes it to a full side panel with editing, re-tiering,
  link/unlink management, and the edit log.
- **Voting** on posts, comments, and nodes (node votes ratify or contest
  placements).
- **Invariants** enforced server-side: no cycles, links flow from higher tier
  to equal-or-lower tier, exactly one Purpose root per board, all tree edits
  logged.

## Stack

Next.js (App Router) + TypeScript, Prisma 6 + SQLite, Tailwind CSS,
iron-session cookie auth. The tree layout is a small hand-rolled layered
algorithm (`lib/treeLayout.ts`) — no graph libraries.

## Useful commands

```bash
npm run db:seed    # re-seed (wipes all data)
npm run db:reset   # drop + re-migrate + re-seed
npx prisma studio  # inspect the DB
```
