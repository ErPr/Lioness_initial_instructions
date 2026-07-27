// Seed demo captured items so the attention heat map has something to show.
// Idempotent: clears prior seeded rows (marked rawText="__seed_capture__")
// first. Run with `npm run db:seed:captures`. Safe to re-run.
import { prisma } from "@/lib/db";
import { confirmPlacementDirect } from "@/lib/seedHelpers";

const MARK = "__seed_capture__";

// How many recent shared items point at each node title, and how many of those
// are confirmed onto the tree vs. still routed (awaiting confirm). Titles are
// matched loosely so this survives seed edits.
const PLAN: { node: string; routed: number; confirmed: number; extraShares?: number }[] = [
  { node: "Overturn Citizens United", routed: 4, confirmed: 3, extraShares: 6 }, // hottest
  { node: "Congressional amendment push", routed: 3, confirmed: 1 },
  { node: "Public financing of elections", routed: 2, confirmed: 1 },
  { node: "Litigation to narrow the doctrine", routed: 1, confirmed: 0 }, // quiet
  { node: "End warrantless Section 702 backdoor searches", routed: 2, confirmed: 1 }, // other board — cross-board heat
];

async function main() {
  const users = await prisma.user.findMany({ take: 6, select: { id: true } });
  if (users.length === 0) throw new Error("Seed the base data first (npm run db:seed).");

  // Clean prior seed rows and any posts they created.
  const prior = await prisma.capturedItem.findMany({
    where: { rawText: MARK },
    select: { id: true, createdPostId: true },
  });
  const priorPosts = prior.map((p) => p.createdPostId).filter(Boolean) as string[];
  if (priorPosts.length) {
    await prisma.nodeEditLog.deleteMany({
      where: { detail: { contains: "shared item" }, action: "LINK" },
    });
    await prisma.post.deleteMany({ where: { id: { in: priorPosts } } });
  }
  await prisma.capturedItem.deleteMany({ where: { rawText: MARK } });

  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  let made = 0;

  for (const p of PLAN) {
    const node = await prisma.treeNode.findFirst({
      where: { title: { contains: p.node }, status: { not: "ARCHIVED" } },
      include: { board: true },
    });
    if (!node) {
      console.warn(`  skip: no node matching "${p.node}"`);
      continue;
    }

    const total = p.routed + p.confirmed;
    for (let i = 0; i < total; i++) {
      const confirmed = i < p.confirmed;
      const user = users[(made + i) % users.length];
      // Spread ages across the last 6 days so decay produces a gradient.
      const ageDays = (i / Math.max(1, total)) * 6;
      const createdAt = new Date(now - ageDays * DAY);
      const shareCount =
        1 + (i === 0 && p.extraShares ? p.extraShares : Math.floor(Math.random() * 2));

      const item = await prisma.capturedItem.create({
        data: {
          userId: user.id,
          url: `https://news.example/${node.board.slug}/${node.id.slice(-6)}-${i}`,
          title: `${node.title}: recent development ${i + 1}`,
          metaTitle: `${node.title}: recent development ${i + 1}`,
          metaDescription: "Seeded demo evidence for the attention heat map.",
          rawText: MARK,
          status: confirmed ? "confirmed" : "routed",
          aiSource: "mock",
          aiConfidence: 0.7,
          boardId: node.boardId,
          nodeId: node.id,
          contributionType: "RESOURCE",
          shareCount,
          createdAt,
        },
      });

      if (confirmed) {
        await confirmPlacementDirect(item.id, user.id, node.id, node.boardId, node.board.slug);
      }
      made++;
    }
    console.log(`  ${node.title} (${node.board.name}): ${total} items`);
  }

  console.log(`Seeded ${made} captured items.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
