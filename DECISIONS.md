# DECISIONS — Collective-Mind Capture Pipeline

Judgment calls made while building the fork, alternatives considered, and
things to flag for review. Newest phase last.

## Fork setup

- **Branch, not a sibling directory.** The brief allowed "a branch
  `collective-mind` if you determine the copy keeps git history cleanly." A
  branch keeps full history and matches the established run workflow (the
  reviewer runs versions via `git checkout`). A second on-disk clone would be
  managed separately and wouldn't get pushed. → developed on `collective-mind`,
  forked from `app-shell-reorg` (the most complete base: tree, flyout tabs,
  automatic statuses, audit log, dark mode all present), and pushed to this
  session's designated branch `claude/new-session-332a0x`.
- **Seed with the 10-board pilot (`npm run db:seed`), not the 131-board atlas.**
  Money Out of Politics is the demo target (brief §3), and a compact tree keeps
  the AI routing dump small. `db:seed:atlas` still exists if a bigger set is
  wanted.
- **Model for routing:** the brief specifies `claude-sonnet-4-6`; honored as the
  explicit choice. Mock mode is the default when no API key is present.

## Phase 1 — Capture

- **PWA icons generated with zero dependencies.** `scripts/make-icons.mjs`
  emits real 192/512 PNGs using only node's `zlib` (a solid amber field with a
  cream "L"), so no image library is added. Alternative — an SVG-only manifest
  icon — risked installability on some Android versions; PNGs are safest for the
  share-sheet acceptance criterion.
- **Static `public/manifest.webmanifest`** rather than Next's `app/manifest.ts`,
  because the generated `MetadataRoute.Manifest` type doesn't model
  `share_target`. Linked via `metadata.manifest`.
- **Uploads live outside `/public`** (`uploads/captures/`, gitignored) and are
  served by an ownership-checked route (`/api/uploads/[id]`) — captured items
  are private until confirmed, so screenshots must not be publicly guessable.
- **`/api/capture` supports GET as well as POST.** POST is the real share
  target; GET (`?url=&title=&text=`) makes the pipeline testable from a desktop
  browser and a `curl`. A desktop "Share something to test" form on `/inbox`
  posts multipart exactly like the share sheet, so the flow can be demoed
  without an Android device.
- **URL-from-text extraction** handles the Android quirk where the shared URL
  arrives in `text` rather than `url` (`extractFirstUrl`).
- **Login gained a `next` param** so an unauthenticated share bounces to login
  and returns to `/inbox`. Restricted to same-site relative paths (`safeNext`).
- The capture handler only writes and redirects — no fetching or AI — so the
  share feels instant (acceptance criterion: "Saved" in under 2 seconds).

## Phase 2 — Enrichment

- **In-process worker via `instrumentation.ts`** so shares enrich and route
  automatically with no second terminal (acceptance criterion: routed "within a
  minute"). A module-level singleton guards against dev-HMR stacking intervals.
  A standalone `npm run worker` is also provided; set `LIONESS_WORKER=off` on the
  server to use only that.
- **No HTML-parser dependency.** Meta tags are scanned with a tolerant regex
  (`lib/enrich.ts`) rather than adding cheerio/jsdom. Verified against reversed
  attribute order, entity decoding, and `<title>` fallback.
- **Fallback chain:** provider oEmbed (YouTube/TikTok/Vimeo, which often block
  scraping) → OpenGraph/meta → share-sheet fields. 6s timeout, one retry on a
  fully-empty fetch, then advance regardless — an item is never stuck on
  enrichment failure.
- **Sandbox note:** outbound fetch is blocked in the build/test environment, so
  enrichment yields no metadata here and items advance to `enriched` with the
  share-sheet title only. On a normal network (the reviewer's machine) metadata
  populates. This is the designed graceful-degradation path, not a bug.

## Phase 3 — AI routing + dedupe

- **Two routers, one output shape.** `lib/route.ts` produces up-to-3
  `{boardId, nodeId, contributionType, confidence}` candidates either from the
  real model (`claude-sonnet-4-6`, JSON-schema structured output) or a
  deterministic **mock keyword-overlap scorer**. The mock is the tested default
  (no `ANTHROPIC_API_KEY` in the sandbox) and also the fallback whenever the
  model errors, refuses, or returns nothing — so the pipeline can never stall on
  routing. Verified: a Citizens United article routes to *Overturn Citizens
  United* in Money Out of Politics at 0.9.
- **`getTreeDump()` is the model's world.** A 60s-cached compact catalogue of
  every board's nodes (id, tier, title, parent titles). Small trees keep the
  prompt cheap; the model may only choose node ids that appear in it, and any id
  it invents is dropped on validation.
- **Cost guard, not a queue.** A per-process sliding-window counter caps real AI
  calls at 40/hour; overflow silently uses the mock router rather than blocking.
  Simple and good enough for a demo; a durable rate limit would move this to the
  DB.
- **Dedupe = fold the re-share into the first share.** Matching is by
  `normalizeUrl` (done in JS — SQLite has no URL function), cross-user, and only
  against items shared *strictly earlier*, so the canonical is deterministically
  the first share even when a burst routes in one batch. The re-share gets
  `dedupeOf` set and the canonical's `shareCount` increments in a transaction.
  Screenshots/text with no URL don't URL-dedupe (a future content-hash pass
  could). Verified: same URL from two accounts → one canonical, `shareCount` 2.
- **A user's inbox shows what they contributed to.** `getInboxItems` now unions
  the canonical items a user shared first with the canonicals they re-shared
  (their folded copy), so a re-share still appears — with the shared-by count —
  instead of vanishing.
- **Contribution type defaults to RESOURCE.** A shared link is a reference; the
  model may override to PROBLEM/SOLUTION/etc. when the item argues rather than
  informs.

## Phase 4 — Confirm loop + tree integration

- **Confirm creates an ordinary Post** (`contributionType` default RESOURCE,
  `treeNodeId` set) via the identical shape `createPost` uses, so a placed
  capture is indistinguishable from a hand-added link: it appears in the node's
  Top Links flyout tab, is votable, and participates in ratify/contest. Verified
  a routed Citizens United item confirms into *Overturn Citizens United*'s Top
  Links next to the seeded Brennan Center link.
- **Private until the tap.** Nothing is public until Confirm; `rejectItem` sets
  status `rejected` and it simply leaves the inbox. Both actions are owner-only,
  and ownership includes a user whose re-share folded into the canonical.
- **Placement is editable before confirming.** The item shows the AI's top pick
  inline with a one-tap Confirm; "Pick different node" opens a grouped select of
  every board's nodes, the runner-up candidates appear as quick chips, and the
  contribution type can be changed. The canonical is always the item placed, so
  the shared-by count carries onto the Post's node.
- **Audit trail.** Each confirm writes a `NodeEditLog` `LINK` entry naming the
  shared item, so the node's history shows where captured evidence came from.
- **Placement always targets the canonical.** Confirming a re-share is blocked
  with a pointer to the original, so one link becomes one Post no matter how many
  people shared it.

## Phase 5 — Attention heat map

- **Heat is recency-decayed, shareCount-weighted.** `lib/heat.ts` scores a node
  by its captured items (routed or confirmed) over the last 7 days, each
  weighted by `shareCount`, halving every ~3 days, with a small bonus for
  confirmed. So the map shows *current* focus, and a burst of shares reads
  hotter than an old trickle. Warmth buckets to 0–4 **relative to the hottest
  node in view**, so the scale reads on a busy or a quiet movement alike.
- **Rendered two ways, additively.** A per-card orange glow + 🔥 count on the
  existing tree (`TreeCanvas`), and a "Where attention is flowing" panel of the
  top-5 hottest nodes (`AttentionPanel`). Level 0 adds nothing, so a board with
  no captures looks exactly as before — the tree/forum/voting are untouched.
- **Aggregate counts respect privacy.** Heat includes routed-but-unconfirmed
  items so incoming attention shows, but only as anonymous totals — no
  unconfirmed item's content or owner is ever exposed. A "confirmed-only" heat
  map is a one-line filter if a movement prefers it.
- **Demo data via `npm run db:seed:captures`.** Idempotent (clears its own prior
  rows), spreads items across nodes/ages/shareCounts so hot and quiet nodes are
  visibly different, and confirms some into real Posts. `lib/seedHelpers.ts`
  places them without a request scope (mirrors `confirmPlacement`'s writes).

## To flag for review

- Icons are a plain amber "L", not brand art — swap when real assets exist.
- The service worker is intentionally a no-op (installability only); there is no
  offline support.
