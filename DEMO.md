# DEMO — Collective-Mind Capture Pipeline

This fork turns Lioness into something members feed from their phones. Share
anything — an article, a TikTok, a screenshot, a tweet — to Lioness, and it
lands in a **private inbox**. A background worker fetches its metadata and an
AI (or a deterministic keyword router when there's no API key) proposes where
it belongs on a movement's goal tree. One tap confirms, and the item becomes
public **evidence** on that node — a real, votable Post, indistinguishable from
a link added by hand. A **heat map** then shows where the collective mind is
pointing: nodes glow with recent shared attention.

Nothing you share is public until you tap Confirm.

---

## 1. Prerequisites

- Node.js 20+ and npm.
- No API key required — the router runs in a deterministic **mock mode** by
  default. (Optional: set `ANTHROPIC_API_KEY` to route with `claude-sonnet-4-6`.)

## 2. Setup

The fork lives on the `claude/new-session-332a0x` branch. From the project
folder:

### Windows (PowerShell)

```powershell
git checkout claude/new-session-332a0x
npm install
npx prisma migrate deploy        # or: npx prisma migrate dev
npm run db:seed                  # 10 pilot movements with trees + users
npm run db:seed:captures         # demo shared items so the heat map has data
npm run dev
```

If PowerShell blocks npm with an execution-policy error, run this once in the
same window, then retry:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### macOS / Linux

```bash
git checkout claude/new-session-332a0x
npm install
npx prisma migrate deploy
npm run db:seed
npm run db:seed:captures
npm run dev
```

Then open **http://localhost:3000**. Log in as any seeded user — e.g.
`ava_quinn` — password **`lioness123`**. (All seeded users share that password;
the seed prints the full list.)

> The capture worker starts **in-process** automatically — no second terminal.
> To run it standalone instead, start the server with `LIONESS_WORKER=off` and
> run `npm run worker` in another window.

---

## 3. The five-minute walkthrough

Each step maps to an acceptance criterion.

### A. Install + share from a phone (PWA share target)
On an Android phone on the same network (or Chrome desktop → **Install app**),
open the site and **Add to Home Screen**. Lioness now appears in the system
**share sheet**. Share a link or screenshot to it → you're bounced to the inbox
with "Saved." (Manifest, service worker, and icons are all served; verify at
`/manifest.webmanifest`.)

**No phone handy?** On `/inbox` there's a **"Share something to test"** form
that posts exactly like the share sheet. Paste any URL and a title, submit.

### B. Enrich + route within a minute
Watch the item in **/inbox**: its pill moves `finding metadata…` →
`routing…` → **`ready to place`** within a few worker ticks (every 4s). It now
shows a suggested board → node with a confidence. Paste a Citizens United
article and it lands on **Overturn Citizens United** in Money Out of Politics.

### C. Confirm places it on the tree
Tap **Confirm**. The item flips to **`on the tree`** with a link to the node.
Open that node's flyout on the tree (`/b/money-out-of-politics/tree`) → the
**Top Links** tab now lists your item next to the hand-added links. It's a
normal Post: upvote it, and node status math applies as usual. Prefer a
different spot? **Pick different node** opens a picker of every board's nodes,
with the runner-up AI suggestions as one-tap chips; **Reject** dismisses it.

### D. Two people, one link (dedupe)
Log in as a second user (e.g. `noah_reed`) and share the **same URL** you shared
in B. Instead of a duplicate, it folds into the first share: the canonical
item's count reads **"you and 1 other shared this"** (`shareCount` 2), and both
users see it in their inbox. Tracking params (`?utm_...`, `fbclid`, a trailing
slash) don't defeat the match.

### E. The attention heat map
On any board's tree, the **"Where attention is flowing"** panel lists the
hottest nodes of the last 7 days, and cards themselves **glow** — a bright
orange halo and a 🔥 count on nodes drawing recent shares, nothing on quiet
ones. With the seeded data, *Overturn Citizens United* burns brightest (level
4, 14 shares) while *Litigation to narrow the doctrine* barely registers (level
1). Heat is `shareCount`-weighted and decays with age, so it tracks **current**
focus, not all-time totals.

---

## 4. How it works (the pipeline)

```
share sheet / test form
        │  POST /api/capture (multipart)          ← Phase 1
        ▼
   CapturedItem  status=pending      (private, owner-only)
        │  worker enrichStep: oEmbed → OpenGraph  ← Phase 2
        ▼
        status=enriched
        │  worker routeStep: dedupe, then         ← Phase 3
        │  mock keyword router OR claude-sonnet-4-6
        ▼
        status=routed   (top-3 candidates stored)
        │  user taps Confirm                       ← Phase 4
        ▼
        status=confirmed → public Post on the node
        │  getNodeHeat aggregates recent evidence  ← Phase 5
        ▼
   tree warmth + "Where attention is flowing"
```

- **Worker:** `lib/worker.ts`, started by `instrumentation.ts`.
- **Enrichment:** `lib/enrich.ts` (no HTML-parser dependency).
- **Routing + dedupe:** `lib/route.ts`, tree snapshot in `lib/treeDump.ts`.
- **Confirm:** `lib/actions/capture.ts` (same Post path as `lib/actions/forum.ts`).
- **Heat:** `lib/heat.ts`, rendered in `components/tree/TreeCanvas.tsx` and
  `components/tree/AttentionPanel.tsx`.

Design judgment calls and their alternatives are in **DECISIONS.md**.

---

## 5. Known gaps

Honest list of what's stubbed, deferred, or thin — nothing here blocks the
acceptance walkthrough, but a reviewer should know:

1. **Enrichment needs real outbound network.** In the sandbox where this was
   built, outbound fetch is blocked, so items advance to `enriched` with only
   the share-sheet title. On a normal machine metadata (title/description/image)
   populates. The parsing itself is unit-verified offline.
2. **Dedupe is URL-only.** Two people sharing the *same link* fold together, but
   the same article via two different URLs (or the same screenshot) won't. A
   content-hash / title-similarity pass is the natural next step; the scaffolding
   (token/trigram helpers) is present in `lib/route.ts`.
3. **Screenshot understanding is not implemented.** An image with no URL enriches
   to nothing and routes on its share-sheet text alone (usually to no
   suggestion, so you place it manually). Vision routing would need the image
   sent to the model.
4. **AI cost guard is per-process, in-memory.** The 40-calls/hour cap resets on
   restart and isn't shared across instances. Fine for a demo; a real limiter
   would live in the DB or a cache.
5. **Heat counts private (routed, unconfirmed) items in aggregate.** The map
   reflects incoming attention before confirmation, but only as anonymous
   counts — no unconfirmed item's content or owner is ever exposed. If a movement
   wanted heat to reflect *only* confirmed evidence, that's a one-line filter.
6. **No offline support.** The service worker exists only to make the app
   installable; it doesn't cache routes.
7. **PWA share-target + install can't be exercised headlessly.** Steps A was
   verified structurally (assets serve, `share_target` is declared); the actual
   Android share sheet needs a device. The desktop test form covers the rest of
   the pipeline end-to-end.
8. **Icons are placeholder art** — a plain amber "L", not brand assets.

---

## 6. Reset

To wipe and re-seed everything (including demo captures):

```bash
npm run db:reset && npm run db:seed && npm run db:seed:captures
```

The original app is untouched — all of this pipeline lives on the
`claude/new-session-332a0x` branch; check out any prior branch to run an
earlier version.
