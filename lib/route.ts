import { prisma } from "@/lib/db";
import { normalizeUrl } from "@/lib/capture";
import { getTreeDump, type DumpBoard, type DumpNode } from "@/lib/treeDump";
import { CONTRIBUTION_TYPES, type ContributionType } from "@/lib/types";

// Phase 3 — the routing brain. Takes an `enriched` CapturedItem and decides
// where on the movement trees it belongs: top-3 {board, node, contributionType,
// confidence}. Two paths, same output shape:
//   • mock    — deterministic keyword-overlap scorer (no API key needed)
//   • claude  — claude-sonnet-4-6 with a JSON-schema structured output
// Also folds re-shares of the same link into one canonical item (dedupe),
// bumping its shareCount. An item never leaves this step unrouted; on any
// failure it falls back to the mock router so the pipeline can't stall.

const MODEL = "claude-sonnet-4-6";
const AI_CALLS_PER_HOUR = 40; // cost guard; mock covers the overflow

export interface RouteCandidate {
  boardId: string;
  nodeId: string;
  contributionType: ContributionType;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "at", "by", "from", "as", "is", "are", "be", "was", "were", "this", "that",
  "it", "its", "how", "why", "what", "we", "our", "you", "your", "they", "their",
  "about", "into", "over", "out", "up", "new", "more", "can", "will", "has",
  "have", "not", "all", "one", "two", "us", "his", "her", "he", "she", "them",
]);

function tokenize(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function itemText(item: {
  metaTitle: string | null;
  metaDescription: string | null;
  title: string | null;
  rawText: string | null;
  url: string | null;
}): string {
  return [item.metaTitle, item.metaDescription, item.title, item.rawText, item.url]
    .filter(Boolean)
    .join(" ");
}

function coerceContribution(v: string | null | undefined): ContributionType {
  const up = (v ?? "").toUpperCase();
  return (CONTRIBUTION_TYPES as readonly string[]).includes(up)
    ? (up as ContributionType)
    : "RESOURCE"; // a shared link is a resource by default
}

// ---------------------------------------------------------------------------
// Mock router — keyword overlap between the item and every node
// ---------------------------------------------------------------------------

export function mockRoute(
  text: string,
  dump: DumpBoard[],
  limit = 3
): RouteCandidate[] {
  const terms = tokenize(text);
  if (terms.length === 0) return [];
  const termSet = new Set(terms);
  // Frequency of each term in the item, so a repeated keyword weighs more.
  const freq = new Map<string, number>();
  for (const t of terms) freq.set(t, (freq.get(t) ?? 0) + 1);

  type Scored = RouteCandidate & { score: number };
  const scored: Scored[] = [];

  for (const board of dump) {
    for (const node of board.nodes) {
      const nodeTerms = new Set([
        ...tokenize(node.title),
        ...node.parents.flatMap((p) => tokenize(p)),
      ]);
      if (nodeTerms.size === 0) continue;

      let overlap = 0;
      let hits = 0;
      for (const nt of nodeTerms) {
        if (termSet.has(nt)) {
          overlap += freq.get(nt) ?? 1;
          hits += 1;
        }
      }
      if (hits === 0) continue;

      // Normalize: reward matches but don't let long node titles dominate.
      const score = overlap * (hits / nodeTerms.size + 0.5);
      scored.push({
        boardId: board.boardId,
        nodeId: node.id,
        contributionType: "RESOURCE",
        confidence: 0, // filled after we know the max
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  const max = top[0]?.score ?? 1;
  return top.map((s) => ({
    boardId: s.boardId,
    nodeId: s.nodeId,
    contributionType: s.contributionType,
    // Map raw score onto a calibrated-ish 0.35–0.9 band relative to the best.
    confidence: Math.round((0.35 + 0.55 * (s.score / max)) * 100) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Claude router
// ---------------------------------------------------------------------------

function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Per-process sliding-window counter so we don't run the model on every item
// in a burst. Overflow silently falls back to the mock router.
const aiCallTimes: number[] = [];
function aiBudgetAvailable(): boolean {
  const now = Date.now();
  const cutoff = now - 60 * 60 * 1000;
  while (aiCallTimes.length && aiCallTimes[0] < cutoff) aiCallTimes.shift();
  return aiCallTimes.length < AI_CALLS_PER_HOUR;
}
function recordAiCall() {
  aiCallTimes.push(Date.now());
}

// Compact the tree dump into a token-frugal catalogue the model can map over.
function renderCatalogue(dump: DumpBoard[]): string {
  const lines: string[] = [];
  for (const b of dump) {
    lines.push(`## ${b.name} [board:${b.boardId}]`);
    for (const n of b.nodes) {
      const ctx = n.parents.length ? ` (under ${n.parents.join(", ")})` : "";
      lines.push(`- ${n.tier}: ${n.title}${ctx} [node:${n.id}]`);
    }
  }
  return lines.join("\n");
}

async function claudeRoute(
  item: { metaTitle: string | null; metaDescription: string | null; title: string | null; rawText: string | null; url: string | null },
  dump: DumpBoard[]
): Promise<RouteCandidate[] | null> {
  // Lazy import so the SDK isn't required in mock-only deployments.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const validNodeIds = new Set<string>();
  for (const b of dump) for (const n of b.nodes) validNodeIds.add(n.id);
  const nodeBoard = new Map<string, string>();
  for (const b of dump) for (const n of b.nodes) nodeBoard.set(n.id, b.boardId);

  const catalogue = renderCatalogue(dump);
  const summary = itemText(item).slice(0, 2000);

  const system =
    "You route a member-shared item (article, video, screenshot, post) onto a " +
    "civic movement's goal tree. Pick the up-to-3 tree nodes where this item is " +
    "the strongest living evidence — supporting, opposing, or informing that " +
    "node's work. Only choose node ids from the catalogue. contributionType is " +
    "one of: RESOURCE (a link/reference — the usual choice), PROBLEM, SOLUTION, " +
    "STRATEGY, TACTIC, QUESTION, DISCUSSION. confidence is 0..1. If nothing fits, " +
    "return an empty list.";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      candidates: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            nodeId: { type: "string" },
            contributionType: {
              type: "string",
              enum: [...CONTRIBUTION_TYPES],
            },
            confidence: { type: "number" },
          },
          required: ["nodeId", "contributionType", "confidence"],
        },
      },
    },
    required: ["candidates"],
  };

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [
      {
        role: "user",
        content:
          `SHARED ITEM:\n${summary || "(no text — likely a screenshot)"}\n\n` +
          `MOVEMENT TREE CATALOGUE:\n${catalogue}`,
      },
    ],
    // Structured output; SDK surfaces refusals via stop_reason.
    output_config: { format: { type: "json_schema", schema } },
  } as never);

  if ((resp as { stop_reason?: string }).stop_reason === "refusal") return null;

  // Pull the JSON out of the first text block.
  const block = (resp as { content: Array<{ type: string; text?: string }> }).content.find(
    (b) => b.type === "text" && b.text
  );
  if (!block?.text) return null;

  let parsed: { candidates?: Array<{ nodeId?: string; contributionType?: string; confidence?: number }> };
  try {
    parsed = JSON.parse(block.text);
  } catch {
    return null;
  }

  const out: RouteCandidate[] = [];
  for (const c of parsed.candidates ?? []) {
    if (!c.nodeId || !validNodeIds.has(c.nodeId)) continue;
    out.push({
      boardId: nodeBoard.get(c.nodeId)!,
      nodeId: c.nodeId,
      contributionType: coerceContribution(c.contributionType),
      confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dedupe — fold a re-share into its canonical item
// ---------------------------------------------------------------------------

/**
 * If this item's normalized URL matches an earlier canonical item (any user),
 * mark it as a re-share and bump the canonical's shareCount. Returns true if
 * the item was folded (and should not be routed on its own).
 */
async function dedupe(item: {
  id: string;
  url: string | null;
  createdAt: Date;
}): Promise<boolean> {
  const norm = normalizeUrl(item.url);
  if (!norm) return false; // no URL (screenshot/text) → can't URL-dedupe

  // Find the oldest canonical item (across all users) with the same normalized
  // URL. We normalize in JS because SQLite has no matching function; the set of
  // recent canonical URL items is small.
  const candidates = await prisma.capturedItem.findMany({
    where: {
      dedupeOf: null,
      url: { not: null },
      status: { notIn: ["rejected"] },
      id: { not: item.id },
      // Only fold into an item shared strictly earlier, so the canonical is
      // always the first share even when a burst is routed in one batch.
      createdAt: { lt: item.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
    take: 500,
  });

  const canonical = candidates.find((c) => normalizeUrl(c.url) === norm);
  if (!canonical) return false;

  await prisma.$transaction([
    prisma.capturedItem.update({
      where: { id: item.id },
      data: { dedupeOf: canonical.id, status: "routed" },
    }),
    prisma.capturedItem.update({
      where: { id: canonical.id },
      data: { shareCount: { increment: 1 } },
    }),
  ]);
  return true;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Route one enriched item: dedupe, then pick candidates, then persist. */
export async function routeEnrichedItem(itemId: string): Promise<void> {
  const item = await prisma.capturedItem.findUnique({ where: { id: itemId } });
  if (!item || item.status !== "enriched") return;

  // 1) Dedupe first — a re-share should never spawn a second routing.
  if (await dedupe(item)) return;

  // 2) Route.
  const dump = await getTreeDump();
  const text = itemText(item);

  let candidates: RouteCandidate[] = [];
  let source: "mock" | "claude" = "mock";

  if (hasApiKey() && aiBudgetAvailable()) {
    try {
      recordAiCall();
      const ai = await claudeRoute(item, dump);
      if (ai && ai.length > 0) {
        candidates = ai;
        source = "claude";
      }
    } catch (err) {
      console.error("[route] claude failed, falling back to mock:", err);
    }
  }

  if (candidates.length === 0) {
    candidates = mockRoute(text, dump);
    source = "mock";
  }

  const top = candidates[0] ?? null;

  await prisma.capturedItem.update({
    where: { id: item.id },
    data: {
      status: "routed",
      aiSource: source,
      aiCandidates: JSON.stringify(candidates),
      aiConfidence: top?.confidence ?? null,
      boardId: top?.boardId ?? null,
      nodeId: top?.nodeId ?? null,
      contributionType: top?.contributionType ?? null,
    },
  });
}
