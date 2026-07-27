# DECISIONS — Collective-Mind Capture Pipeline

Judgment calls made while building the fork, alternatives considered, and
things to flag for review. Newest phase last.

## Fork setup

- **Branch, not a sibling directory.** The brief allowed "a branch
  `collective-mind` if you determine the copy keeps git history cleanly." A
  branch keeps full history and matches the established run workflow (the
  reviewer runs versions via `git checkout`). A second on-disk clone would be
  managed separately and wouldn't get pushed. → branch `collective-mind`,
  forked from `app-shell-reorg` (the most complete base: tree, flyout tabs,
  automatic statuses, audit log, dark mode all present).
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

## To flag for review

- Icons are a plain amber "L", not brand art — swap when real assets exist.
- The service worker is intentionally a no-op (installability only); there is no
  offline support.
