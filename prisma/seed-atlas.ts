/**
 * Atlas seed: builds a board + goal tree for every movement in
 * prisma/atlas-data.json (the "Collective Effort Atlas" dump — 131 movements
 * across 10 categories).
 *
 * Mapping:
 *   Goal          → Purpose root node (why-now as its summary)
 *   Action Nodes  → Strategy-tier children, vote-ranked so the working-plan
 *                   cutoff and candidate pools appear naturally
 *   Why Now       → a Discussion post attached to the Purpose
 *   Key Actors    → a Resource post ("who's driving this")
 *   Online Hubs   → a Resource post ("where it organizes")
 *   Momentum      → seeded upvotes on the Purpose (high momentum ⇒ ratified)
 *
 * Run with: npm run db:seed:atlas   (wipes existing data first — pilot only!)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeNodeStatus } from "../lib/status";
import atlas from "./atlas-data.json";

const prisma = new PrismaClient();
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

const USERNAMES = [
  "ava_quinn",
  "marcus_w",
  "priya_s",
  "dan_oconnell",
  "lena_ortiz",
  "jkim",
  "ruth_b",
  "sam_delgado",
];

interface AtlasEntry {
  slug: string;
  name: string;
  category: string;
  type: string;
  region: string;
  scope: string;
  lists: string;
  momentum: number;
  importance: number;
  goal: string;
  whyNow: string;
  actors: string;
  hubs: string;
  actions: string[];
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.membership.deleteMany();
  await prisma.vote.deleteMany();
  await prisma.nodeEditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.nodeLink.deleteMany();
  await prisma.treeNode.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash("lioness123", 10);
  const users: string[] = [];
  for (const username of USERNAMES) {
    const u = await prisma.user.create({
      data: { username, passwordHash, createdAt: daysAgo(90) },
    });
    users.push(u.id);
  }
  // Deterministic pseudo-random pick so re-seeds are reproducible.
  const pick = (seed: number) => users[seed % users.length];

  const entries = atlas as AtlasEntry[];
  console.log(`Building ${entries.length} movement boards...`);

  let i = 0;
  for (const m of entries) {
    i++;
    const founder = pick(i);
    const board = await prisma.board.create({
      data: {
        slug: m.slug,
        name: m.name,
        description: m.goal,
        category: m.category,
        momentum: m.momentum,
        importance: m.importance,
        createdAt: daysAgo(75),
      },
    });

    // Purpose root: the movement's goal statement.
    const purpose = await prisma.treeNode.create({
      data: {
        boardId: board.id,
        tier: "PURPOSE",
        title: m.goal,
        summary: `${m.type} · ${m.region}. ${m.whyNow}`,
        createdByUserId: founder,
        createdAt: daysAgo(74),
      },
    });
    await prisma.nodeEditLog.create({
      data: {
        nodeId: purpose.id,
        userId: founder,
        action: "CREATE",
        detail: "Purpose root created from atlas import",
        createdAt: daysAgo(74),
      },
    });

    // Momentum → purpose upvotes (>=85 ratifies at 6, >=75 ratifies at 5,
    // >=65 lands at 4 proposed, else 3 proposed).
    const ups = m.momentum >= 85 ? 6 : m.momentum >= 75 ? 5 : m.momentum >= 65 ? 4 : 3;
    for (let v = 0; v < ups; v++) {
      await prisma.vote.create({
        data: {
          userId: users[v],
          targetType: "NODE",
          targetId: purpose.id,
          value: 1,
          createdAt: daysAgo(30 - (v % 20)),
        },
      });
    }

    // Action nodes → strategy-tier children, ranked by seeded votes so the
    // slot cutoff shows up on 4-item movements.
    let a = 0;
    for (const action of m.actions) {
      const by = pick(i + a + 1);
      const nodeVotes = Math.max(0, 2 - a); // 2,1,0,0 → clear ranking
      const node = await prisma.treeNode.create({
        data: {
          boardId: board.id,
          tier: "STRATEGY",
          title: action,
          summary: "",
          createdByUserId: by,
          createdAt: daysAgo(70 - a),
        },
      });
      await prisma.nodeLink.create({
        data: {
          parentNodeId: purpose.id,
          childNodeId: node.id,
          createdByUserId: by,
          createdAt: daysAgo(70 - a),
        },
      });
      await prisma.nodeEditLog.create({
        data: {
          nodeId: node.id,
          userId: by,
          action: "CREATE",
          detail: `Created as STRATEGY from atlas action list`,
          createdAt: daysAgo(70 - a),
        },
      });
      for (let v = 0; v < nodeVotes; v++) {
        await prisma.vote.create({
          data: {
            userId: users[(i + v) % users.length],
            targetType: "NODE",
            targetId: node.id,
            value: 1,
            createdAt: daysAgo(20 - v),
          },
        });
      }
      a++;
    }

    // Starter posts: why-now discussion + two resources, all attached to the
    // Purpose so every flyout tab has content.
    const posts = [
      {
        title: "Why this is surging right now",
        body: m.whyNow,
        type: "DISCUSSION",
        age: 8 + (i % 20),
        score: 2,
      },
      {
        title: `Who's driving it: key actors and organizations`,
        body: m.actors,
        type: "RESOURCE",
        age: 12 + (i % 20),
        score: 3,
      },
      {
        title: "Where this effort organizes online",
        body: m.hubs,
        type: "RESOURCE",
        age: 15 + (i % 20),
        score: 1,
      },
    ];
    let p = 0;
    for (const pd of posts) {
      const post = await prisma.post.create({
        data: {
          boardId: board.id,
          authorId: pick(i + p + 3),
          title: pd.title,
          body: pd.body,
          contributionType: pd.type,
          treeNodeId: purpose.id,
          createdAt: daysAgo(pd.age),
        },
      });
      for (let v = 0; v < pd.score; v++) {
        await prisma.vote.create({
          data: {
            userId: users[(i + p + v + 1) % users.length],
            targetType: "POST",
            targetId: post.id,
            value: 1,
            createdAt: daysAgo(Math.max(1, pd.age - 2 - v)),
          },
        });
      }
      p++;
    }
    if (i % 25 === 0) console.log(`  ${i}/${entries.length}...`);
  }

  // Memberships: ava_quinn joins the top-momentum boards (so the demo login
  // lands on a lively dashboard); everyone else joins a deterministic spread.
  console.log("Creating memberships...");
  const boards = await prisma.board.findMany({
    orderBy: { momentum: "desc" },
    select: { id: true },
  });
  for (let b = 0; b < 5 && b < boards.length; b++) {
    await prisma.membership.create({
      data: { userId: users[0], boardId: boards[b].id, createdAt: daysAgo(60) },
    });
  }
  for (let u = 1; u < users.length; u++) {
    for (let k = 0; k < 6; k++) {
      const idx = (u * 13 + k * 17) % boards.length;
      await prisma.membership.upsert({
        where: {
          userId_boardId: { userId: users[u], boardId: boards[idx].id },
        },
        update: {},
        create: {
          userId: users[u],
          boardId: boards[idx].id,
          createdAt: daysAgo(55 - k),
        },
      });
    }
  }

  // Derive every node status through the same automatic rule as the app.
  console.log("Deriving node statuses from votes...");
  const allNodes = await prisma.treeNode.findMany({
    select: { id: true, status: true },
  });
  for (const n of allNodes) {
    const votes = await prisma.vote.findMany({
      where: { targetType: "NODE", targetId: n.id },
      select: { value: true },
    });
    const up = votes.filter((v) => v.value > 0).length;
    const down = votes.filter((v) => v.value < 0).length;
    const next = computeNodeStatus(up, down);
    if (next !== n.status) {
      await prisma.treeNode.update({ where: { id: n.id }, data: { status: next } });
    }
  }

  const counts = {
    boards: await prisma.board.count(),
    nodes: await prisma.treeNode.count(),
    links: await prisma.nodeLink.count(),
    posts: await prisma.post.count(),
    votes: await prisma.vote.count(),
  };
  console.log("Atlas seed complete:", counts);
  console.log('All seed users have password "lioness123".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
