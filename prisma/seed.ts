/**
 * Lioness pilot seed: ten movement boards.
 * - "Money Out of Politics" is built out fully as the flagship demo.
 * - The other nine get a Purpose root, a few Goals, and starter posts.
 *
 * Run with: npm run db:seed  (wipes existing data first — pilot only!)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000);

type Tier = "PURPOSE" | "ROOT_ISSUE" | "GOAL" | "STRATEGY" | "TACTIC" | "ACTION";
type Status = "PROPOSED" | "RATIFIED" | "CONTESTED" | "ARCHIVED";

async function main() {
  console.log("Clearing existing data...");
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
  const usernames = [
    "ava_quinn",
    "marcus_w",
    "priya_s",
    "dan_oconnell",
    "lena_ortiz",
    "jkim",
    "ruth_b",
    "sam_delgado",
  ];
  const users: Record<string, { id: string }> = {};
  for (const username of usernames) {
    users[username] = await prisma.user.create({
      data: { username, passwordHash, createdAt: daysAgo(90) },
    });
  }
  const U = (name: string) => users[name].id;

  // ---- helpers ----------------------------------------------------------

  async function makeBoard(slug: string, name: string, description: string) {
    return prisma.board.create({
      data: { slug, name, description, createdAt: daysAgo(80) },
    });
  }

  async function makeNode(opts: {
    boardId: string;
    tier: Tier;
    title: string;
    summary?: string;
    status?: Status;
    by?: string;
    ageDays?: number;
  }) {
    const by = opts.by ?? "ava_quinn";
    const node = await prisma.treeNode.create({
      data: {
        boardId: opts.boardId,
        tier: opts.tier,
        title: opts.title,
        summary: opts.summary ?? "",
        status: opts.status ?? "RATIFIED",
        createdByUserId: U(by),
        createdAt: daysAgo(opts.ageDays ?? 70),
      },
    });
    await prisma.nodeEditLog.create({
      data: {
        nodeId: node.id,
        userId: U(by),
        action: "CREATE",
        detail: `Created as ${opts.tier}: "${opts.title}"`,
        createdAt: daysAgo(opts.ageDays ?? 70),
      },
    });
    return node;
  }

  async function link(
    parent: { id: string; title: string },
    child: { id: string },
    by = "ava_quinn"
  ) {
    await prisma.nodeLink.create({
      data: {
        parentNodeId: parent.id,
        childNodeId: child.id,
        createdByUserId: U(by),
        createdAt: daysAgo(65),
      },
    });
    await prisma.nodeEditLog.create({
      data: {
        nodeId: child.id,
        userId: U(by),
        action: "LINK",
        detail: `Linked under "${parent.title}"`,
        createdAt: daysAgo(65),
      },
    });
  }

  async function makePost(opts: {
    boardId: string;
    by: string;
    title: string;
    body: string;
    type?: string;
    nodeId?: string;
    ageDays?: number;
    proposedTier?: Tier;
    proposedTitle?: string;
  }) {
    return prisma.post.create({
      data: {
        boardId: opts.boardId,
        authorId: U(opts.by),
        title: opts.title,
        body: opts.body,
        contributionType: opts.type ?? "DISCUSSION",
        treeNodeId: opts.nodeId,
        proposesNode: !!opts.proposedTitle,
        proposedTier: opts.proposedTier,
        proposedTitle: opts.proposedTitle,
        createdAt: daysAgo(opts.ageDays ?? 30),
      },
    });
  }

  async function makeComment(opts: {
    postId: string;
    by: string;
    body: string;
    type?: string;
    nodeId?: string;
    parentId?: string;
    ageDays?: number;
  }) {
    return prisma.comment.create({
      data: {
        postId: opts.postId,
        authorId: U(opts.by),
        body: opts.body,
        contributionType: opts.type ?? "DISCUSSION",
        treeNodeId: opts.nodeId,
        parentCommentId: opts.parentId,
        createdAt: daysAgo(opts.ageDays ?? 25),
      },
    });
  }

  async function castVotes(
    targetType: "POST" | "COMMENT" | "NODE",
    targetId: string,
    voters: string[],
    opts: { value?: number; ageDays?: number } = {}
  ) {
    for (const v of voters) {
      await prisma.vote.create({
        data: {
          userId: U(v),
          targetType,
          targetId,
          value: opts.value ?? 1,
          createdAt: daysAgo(opts.ageDays ?? 20),
        },
      });
    }
  }

  // ---- Flagship: Money Out of Politics ----------------------------------

  console.log("Building Money Out of Politics (flagship)...");
  const mop = await makeBoard(
    "money-out-of-politics",
    "Money Out of Politics",
    "Ending the dominance of concentrated money over American elections and policy — amendment, public financing, and transparency."
  );

  const purpose = await makeNode({
    boardId: mop.id,
    tier: "PURPOSE",
    title: "End the dominance of big money in American politics",
    summary:
      "Elections and policy should answer to voters, not to the largest donors. This tree maps the goals, strategies, and tactics the movement is coordinating on.",
    ageDays: 80,
  });

  // Goals
  const gAmend = await makeNode({
    boardId: mop.id,
    tier: "GOAL",
    title: "Overturn Citizens United",
    summary:
      "Reverse the doctrine that unlimited independent spending is protected speech (Citizens United v. FEC, 2010; SpeechNow v. FEC).",
    by: "marcus_w",
  });
  const gPublic = await makeNode({
    boardId: mop.id,
    tier: "GOAL",
    title: "Public financing of elections",
    summary:
      "Make small-donor and public funding a viable path to office so candidates aren't dependent on big checks.",
    by: "priya_s",
  });
  const gTransparency = await makeNode({
    boardId: mop.id,
    tier: "GOAL",
    title: "Full transparency of political spending",
    summary:
      "Every dollar spent to influence elections should be traceable to its true source — no more dark money via 501(c)(4)s and shell LLCs.",
    by: "lena_ortiz",
  });
  for (const g of [gAmend, gPublic, gTransparency]) await link(purpose, g);

  // Strategies
  const sCongress = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "Congressional amendment push",
    summary:
      "Win two-thirds of both chambers for a democracy amendment (e.g. the For Our Freedom Amendment), then ratification by 38 states.",
    by: "marcus_w",
  });
  const sStates = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "State resolutions & Article V pressure",
    summary:
      "Stack up state legislative resolutions calling for an amendment — 22 states have passed some form — to force Congress's hand or trigger a convention.",
    by: "dan_oconnell",
  });
  const sFedLeg = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "Federal small-donor matching legislation",
    summary:
      "Freedom to Vote Act–style 6:1 matching for small contributions to congressional candidates.",
    by: "priya_s",
  });
  const sLocal = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "State & local ballot initiatives",
    summary:
      "Win public financing and disclosure city-by-city and state-by-state where legislatures won't act.",
    by: "jkim",
  });
  const sDisclose = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "Pass the DISCLOSE Act",
    summary:
      "Require organizations spending in elections to disclose donors above $10,000 and stand by their ads.",
    by: "lena_ortiz",
  });
  const sSec = await makeNode({
    boardId: mop.id,
    tier: "STRATEGY",
    title: "SEC corporate spending disclosure rule",
    summary:
      "Petition and pressure the SEC to require public companies to disclose political spending to shareholders.",
    by: "ruth_b",
    status: "PROPOSED",
  });
  await link(gAmend, sCongress, "marcus_w");
  await link(gAmend, sStates, "dan_oconnell");
  await link(gPublic, sFedLeg, "priya_s");
  await link(gPublic, sLocal, "jkim");
  await link(gTransparency, sDisclose, "lena_ortiz");
  await link(gTransparency, sSec, "ruth_b");

  // Tactics — including shared tactics with multiple parents.
  const tAmendment = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "Constitutional Amendment (28th Amendment)",
    summary:
      "The end-state instrument itself: draft text allowing regulation of election spending. Serves both the congressional route and the state-pressure route.",
    by: "marcus_w",
  });
  const tConvention = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "Constitutional Convention (Article V)",
    summary:
      "34 state applications force a convention to propose amendments. High leverage, but contested inside the movement over runaway-convention risk.",
    by: "dan_oconnell",
    status: "CONTESTED",
  });
  const tMatching = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "Small-donor matching programs",
    summary:
      "6:1 or better matching of small contributions — the H.R. 1 federal model and NYC's long-running program. Works at federal, state, and city level.",
    by: "priya_s",
  });
  const tVouchers = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "Democracy vouchers (Seattle model)",
    summary:
      "Every voter gets publicly funded vouchers to donate to candidates. Seattle has run this since 2017.",
    by: "jkim",
  });
  const tShareholder = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "Shareholder disclosure resolutions",
    summary:
      "File resolutions at major companies demanding political-spending disclosure; win by embarrassment where the SEC won't act.",
    by: "ruth_b",
    status: "PROPOSED",
  });
  const tLobbyDay = await makeNode({
    boardId: mop.id,
    tier: "TACTIC",
    title: "State legislature lobby days",
    summary:
      "Coordinated constituent lobby days for resolution votes and ballot-measure campaigns.",
    by: "sam_delgado",
  });

  // Shared: Constitutional Amendment serves BOTH amendment strategies.
  await link(sCongress, tAmendment, "marcus_w");
  await link(sStates, tAmendment, "marcus_w");
  // Shared: Convention pressure serves the state route AND (as leverage) the congressional route.
  await link(sStates, tConvention, "dan_oconnell");
  await link(sCongress, tConvention, "dan_oconnell");
  // Shared: matching programs serve federal legislation AND local initiatives.
  await link(sFedLeg, tMatching, "priya_s");
  await link(sLocal, tMatching, "priya_s");
  await link(sLocal, tVouchers, "jkim");
  await link(sSec, tShareholder, "ruth_b");
  // Shared: lobby days serve the state-resolution push and local initiatives.
  await link(sStates, tLobbyDay, "sam_delgado");
  await link(sLocal, tLobbyDay, "sam_delgado");

  // Node votes (ratification signal)
  await castVotes("NODE", purpose.id, ["ava_quinn", "marcus_w", "priya_s", "dan_oconnell", "lena_ortiz", "jkim"]);
  await castVotes("NODE", gAmend.id, ["ava_quinn", "marcus_w", "dan_oconnell", "lena_ortiz", "sam_delgado"]);
  await castVotes("NODE", gPublic.id, ["priya_s", "jkim", "ruth_b", "ava_quinn"]);
  await castVotes("NODE", gTransparency.id, ["lena_ortiz", "ruth_b", "jkim"]);
  await castVotes("NODE", tAmendment.id, ["marcus_w", "ava_quinn", "lena_ortiz", "priya_s"]);
  await castVotes("NODE", tConvention.id, ["dan_oconnell", "sam_delgado"]);
  await castVotes("NODE", tConvention.id, ["ruth_b", "lena_ortiz"], { value: -1, ageDays: 5 });
  await castVotes("NODE", tMatching.id, ["priya_s", "jkim", "ava_quinn"]);
  await castVotes("NODE", tVouchers.id, ["jkim", "sam_delgado"]);

  // Posts & comments across the tree, varied types so every flyout tab has content.
  const p1 = await makePost({
    boardId: mop.id,
    by: "lena_ortiz",
    type: "RESOURCE",
    nodeId: gAmend.id,
    ageDays: 40,
    title: "Brennan Center explainer: Citizens United and its aftermath",
    body: "Good primer for newcomers on what the decision actually held and the doctrinal chain (Buckley → Citizens United → SpeechNow) that produced super PACs.\nhttps://www.brennancenter.org/our-work/research-reports/citizens-united-explained",
  });
  const p2 = await makePost({
    boardId: mop.id,
    by: "marcus_w",
    type: "RESOURCE",
    nodeId: tAmendment.id,
    ageDays: 35,
    title: "Text of the For Our Freedom Amendment (H.J.Res. 54)",
    body: "The amendment language American Promise is organizing behind. Note it authorizes regulation rather than mandating any particular scheme.\nhttps://www.congress.gov/bill/118th-congress/house-joint-resolution/54",
  });
  const p3 = await makePost({
    boardId: mop.id,
    by: "ruth_b",
    type: "RESOURCE",
    nodeId: gTransparency.id,
    ageDays: 12,
    title: "OpenSecrets: 2024 cycle dark money topped $1.9B",
    body: "Their tracking of election spending by groups that don't disclose donors. Useful chart for lobby-day handouts.\nhttps://www.opensecrets.org/dark-money",
  });
  const p4 = await makePost({
    boardId: mop.id,
    by: "dan_oconnell",
    type: "STRATEGY",
    nodeId: sStates.id,
    ageDays: 28,
    title: "State resolutions are the pressure valve — 22 down, focus on the next 5",
    body: "Twenty-two states have formally called for an amendment. The realistic near-term targets based on legislative math are Maine, Nevada, Michigan, Minnesota, and Virginia. Proposing we concentrate volunteer phone-banking there instead of spreading across all 50.",
  });
  const p5 = await makePost({
    boardId: mop.id,
    by: "ruth_b",
    type: "PROBLEM",
    nodeId: tConvention.id,
    ageDays: 22,
    title: "Runaway convention risk is our biggest internal disagreement",
    body: "Several coalition partners (notably Common Cause) oppose the Article V route because a convention's scope can't be reliably limited. If we lead with it, we lose allies we need for the state-resolution count. We should be honest that this tactic is contested and sequence accordingly.",
  });
  const p6 = await makePost({
    boardId: mop.id,
    by: "priya_s",
    type: "SOLUTION",
    nodeId: tMatching.id,
    ageDays: 18,
    title: "NYC's 8:1 match shows small-donor programs change who runs",
    body: "After NYC moved to 8:1 matching, campaigns' median donation dropped and the council got measurably more diverse. Campaign Finance Board reports are the best evidence base we have for the federal 6:1 proposal.",
  });
  const p7 = await makePost({
    boardId: mop.id,
    by: "jkim",
    type: "TACTIC",
    nodeId: tVouchers.id,
    ageDays: 15,
    title: "Democracy voucher expansion: Oakland's Measure W is the next test",
    body: "Oakland voters approved democracy dollars in 2022 (Measure W) modeled on Seattle. Implementation has been delayed by budget issues — if it launches well, it becomes the second proof point we can take to other cities.",
  });
  const p8 = await makePost({
    boardId: mop.id,
    by: "lena_ortiz",
    type: "QUESTION",
    nodeId: sDisclose.id,
    ageDays: 9,
    title: "Does the DISCLOSE Act cover LLC pass-throughs?",
    body: "Reading S. 512 — the transfer provisions seem to reach contributions routed through intermediaries, but I can't tell if single-member LLCs formed day-of are covered. Anyone with campaign-finance law background able to clarify?",
  });
  const p9 = await makePost({
    boardId: mop.id,
    by: "sam_delgado",
    type: "TACTIC",
    nodeId: tLobbyDay.id,
    ageDays: 6,
    title: "Template packet for state lobby days (agenda, one-pagers, ask sheet)",
    body: "Cleaned up the packet we used in Harrisburg: suggested meeting agenda, a one-page Citizens United explainer, the resolution text, and a leave-behind ask sheet. Reuse freely — worked well with staffers who had 15 minutes.",
  });
  const p10 = await makePost({
    boardId: mop.id,
    by: "ava_quinn",
    type: "DISCUSSION",
    nodeId: purpose.id,
    ageDays: 50,
    title: "What does 'winning' actually look like for this movement?",
    body: "An amendment is the north star, but we should define intermediate wins: X states with public financing, dark money below some threshold, disclosure within 48 hours. Concrete milestones keep volunteers engaged through a decade-long fight. What would you put on the list?",
  });
  const p11 = await makePost({
    boardId: mop.id,
    by: "marcus_w",
    type: "RESOURCE",
    nodeId: tConvention.id,
    ageDays: 3,
    title: "Congressional Research Service report on Article V conventions",
    body: "The neutral source on what we actually know about convention procedure — delegate selection, scope limits, ratification. Required reading before arguing either side of the runaway question.\nhttps://crsreports.congress.gov/product/pdf/R/R42589",
  });
  const p12 = await makePost({
    boardId: mop.id,
    by: "jkim",
    type: "RESOURCE",
    nodeId: tMatching.id,
    ageDays: 2,
    title: "Campaign Finance Board 2024 post-election report (NYC matching data)",
    body: "Latest participation numbers: 81% of city council candidates joined the matching program. Data appendix has per-district small-donor share.\nhttps://www.nyccfb.info/reports",
  });
  const p13 = await makePost({
    boardId: mop.id,
    by: "dan_oconnell",
    type: "DISCUSSION",
    ageDays: 4,
    title: "Should we track corporate-pledge campaigns as their own tactic?",
    body: "Patagonia-style pledges not to donate to certain campaigns keep coming up in meetings. Feels adjacent to shareholder resolutions but distinct — voluntary, PR-driven. Worth a node?",
    proposedTier: "TACTIC",
    proposedTitle: "Corporate no-donation pledges",
  });

  // Comments (threaded, some attached to different nodes than their post)
  const c1 = await makeComment({
    postId: p5.id,
    by: "dan_oconnell",
    ageDays: 21,
    body: "The CRS report is genuinely reassuring on this — 27 states already have delegate-limitation statutes. I think the risk is overstated, but agree we shouldn't lead with it.",
    type: "DISCUSSION",
  });
  await makeComment({
    postId: p5.id,
    by: "lena_ortiz",
    parentId: c1.id,
    ageDays: 20,
    body: "Delegate-limitation statutes have never been tested in court though. The honest position is 'unknown risk', not 'managed risk'.",
  });
  await makeComment({
    postId: p5.id,
    by: "ava_quinn",
    ageDays: 19,
    type: "SOLUTION",
    nodeId: sStates.id,
    body: "Sequencing proposal: keep resolutions ambiguous between 'call on Congress' and Article V applications. Most state texts already are. That preserves the coalition while keeping the pressure real.",
  });
  const c4 = await makeComment({
    postId: p10.id,
    by: "priya_s",
    ageDays: 48,
    type: "SOLUTION",
    body: "Milestone list: (1) 25 state resolutions, (2) federal matching passes the House once, (3) five more cities with vouchers or matching, (4) DISCLOSE gets 60 Senate votes. Each is lobbyable on its own.",
  });
  await makeComment({
    postId: p10.id,
    by: "marcus_w",
    parentId: c4.id,
    ageDays: 47,
    body: "Adding: an SEC disclosure rule surviving judicial review. That one doesn't need Congress at all.",
    type: "STRATEGY",
    nodeId: sSec.id,
  });
  await makeComment({
    postId: p8.id,
    by: "ruth_b",
    ageDays: 8,
    body: "Section 4 covers 'covered transfers' which includes intermediary routing — but the FEC would have to write the LLC lookthrough rules, and the current commission deadlocks on everything. Enforcement is the real gap.",
    type: "PROBLEM",
  });
  await makeComment({
    postId: p9.id,
    by: "ava_quinn",
    ageDays: 5,
    body: "Used this in Augusta last week — the ask sheet format got us two co-sponsors. Small edit suggestion: add a QR code to the resolution tracker.",
  });
  await makeComment({
    postId: p2.id,
    by: "sam_delgado",
    ageDays: 30,
    type: "QUESTION",
    body: "Does the 'For Our Freedom' text distinguish corporations from unions, or treat all artificial entities alike? That's the first question every legislator asks.",
  });

  // Post/comment votes — mix of all-time and recent (feeds News/Trending velocity)
  await castVotes("POST", p1.id, ["ava_quinn", "marcus_w", "priya_s", "dan_oconnell", "jkim"], { ageDays: 35 });
  await castVotes("POST", p2.id, ["ava_quinn", "lena_ortiz", "dan_oconnell", "ruth_b"], { ageDays: 30 });
  await castVotes("POST", p3.id, ["marcus_w", "jkim", "sam_delgado"], { ageDays: 3 });
  await castVotes("POST", p4.id, ["ava_quinn", "marcus_w", "sam_delgado", "lena_ortiz"], { ageDays: 25 });
  await castVotes("POST", p5.id, ["ava_quinn", "priya_s", "lena_ortiz", "marcus_w", "jkim"], { ageDays: 20 });
  await castVotes("POST", p6.id, ["jkim", "ava_quinn", "ruth_b"], { ageDays: 15 });
  await castVotes("POST", p7.id, ["priya_s", "sam_delgado"], { ageDays: 2 });
  await castVotes("POST", p9.id, ["ava_quinn", "marcus_w", "priya_s", "jkim", "ruth_b", "lena_ortiz"], { ageDays: 4 });
  await castVotes("POST", p11.id, ["ruth_b", "lena_ortiz", "ava_quinn", "dan_oconnell"], { ageDays: 1 });
  await castVotes("POST", p12.id, ["priya_s", "ava_quinn"], { ageDays: 1 });
  await castVotes("POST", p13.id, ["jkim"], { ageDays: 3 });
  await castVotes("COMMENT", c1.id, ["marcus_w", "sam_delgado"], { ageDays: 20 });
  await castVotes("COMMENT", c4.id, ["ava_quinn", "lena_ortiz", "jkim"], { ageDays: 45 });

  // ---- The other nine pilot boards --------------------------------------

  console.log("Building the nine starter boards...");

  async function starterBoard(opts: {
    slug: string;
    name: string;
    description: string;
    purpose: string;
    purposeSummary: string;
    goals: { title: string; summary: string; status?: Status }[];
    posts: {
      by: string;
      title: string;
      body: string;
      type?: string;
      goalIndex?: number;
      ageDays?: number;
    }[];
  }) {
    const board = await makeBoard(opts.slug, opts.name, opts.description);
    const root = await makeNode({
      boardId: board.id,
      tier: "PURPOSE",
      title: opts.purpose,
      summary: opts.purposeSummary,
      ageDays: 75,
    });
    const goalNodes = [];
    for (const g of opts.goals) {
      const gn = await makeNode({
        boardId: board.id,
        tier: "GOAL",
        title: g.title,
        summary: g.summary,
        status: g.status ?? "PROPOSED",
        by: "marcus_w",
        ageDays: 70,
      });
      await link(root, gn, "marcus_w");
      goalNodes.push(gn);
    }
    for (const p of opts.posts) {
      await makePost({
        boardId: board.id,
        by: p.by,
        title: p.title,
        body: p.body,
        type: p.type,
        nodeId: p.goalIndex !== undefined ? goalNodes[p.goalIndex].id : undefined,
        ageDays: p.ageDays,
      });
    }
    await castVotes("NODE", root.id, ["ava_quinn", "marcus_w"]);
    return board;
  }

  await starterBoard({
    slug: "fourth-amendment-surveillance-reform",
    name: "Fourth Amendment & Surveillance Reform",
    description:
      "Restoring warrant protections in the digital age — Section 702, data brokers, and device searches.",
    purpose: "Restore Fourth Amendment protections in the digital age",
    purposeSummary:
      "Government access to our communications, location, and records should require a warrant — no back doors through statutes or data markets.",
    goals: [
      {
        title: "End warrantless Section 702 backdoor searches",
        summary:
          "Require a warrant before querying FISA Section 702 collections for Americans' communications.",
        status: "RATIFIED",
      },
      {
        title: "Close the data-broker loophole",
        summary:
          "Pass the Fourth Amendment Is Not For Sale Act so agencies can't buy data they'd otherwise need a warrant to collect.",
      },
      {
        title: "Warrant requirement for border device searches",
        summary:
          "End suspicionless searches of phones and laptops at ports of entry.",
      },
    ],
    posts: [
      {
        by: "lena_ortiz",
        type: "RESOURCE",
        goalIndex: 1,
        ageDays: 14,
        title: "EFF explainer on the Fourth Amendment Is Not For Sale Act",
        body: "Clear breakdown of how agencies purchase location data from brokers and what H.R. 4639 would prohibit.\nhttps://www.eff.org/deeplinks/2024/04/fourth-amendment-not-sale-act-passes-house",
      },
      {
        by: "dan_oconnell",
        type: "PROBLEM",
        goalIndex: 0,
        ageDays: 10,
        title: "702 reauthorization keeps passing without a warrant requirement",
        body: "The 2024 RISAA reauthorization extended 702 to 2026 and the warrant amendment failed on a tie vote in the House. We need a district-by-district map of the members who flipped.",
      },
      {
        by: "jkim",
        ageDays: 6,
        title: "Coordinating with state-level ECPA reform groups?",
        body: "Utah and California have state warrant requirements for some digital records. Is anyone tracking which state models are strongest so we can push them elsewhere while federal reform stalls?",
      },
    ],
  });

  await starterBoard({
    slug: "congressional-stock-trading-ban",
    name: "Congressional Stock Trading Ban",
    description:
      "Members of Congress shouldn't trade individual stocks while writing the laws that move markets.",
    purpose: "Ban stock trading by members of Congress",
    purposeSummary:
      "Members and their households should hold diversified funds or blind trusts — nothing they can trade on non-public information.",
    goals: [
      {
        title: "Pass the ETHICS Act",
        summary:
          "The bipartisan Senate bill banning member and spouse trading with real divestment deadlines.",
        status: "RATIFIED",
      },
      {
        title: "Cover spouses and dependent children",
        summary:
          "Any ban that exempts household accounts is a ban in name only.",
      },
      {
        title: "Real enforcement, not $200 fines",
        summary:
          "STOCK Act violations currently cost less than a parking ticket; penalties must scale to profits.",
      },
    ],
    posts: [
      {
        by: "sam_delgado",
        type: "RESOURCE",
        goalIndex: 2,
        ageDays: 12,
        title: "Campaign Legal Center's STOCK Act violation tracker",
        body: "Running list of late and missing disclosures — useful for press outreach in members' districts.\nhttps://campaignlegal.org/work/ethics",
      },
      {
        by: "ava_quinn",
        type: "DISCUSSION",
        goalIndex: 0,
        ageDays: 8,
        title: "The ETHICS Act cleared committee — what's the floor math?",
        body: "Senate HSGAC reported it out in July 2024 with bipartisan votes. Whip count suggests 50s in the Senate but leadership won't schedule it. Discharge petition options?",
      },
    ],
  });

  await starterBoard({
    slug: "congressional-term-limits",
    name: "Congressional Term Limits",
    description:
      "Building the case and the coalition for limiting congressional tenure.",
    purpose: "Enact term limits for members of Congress",
    purposeSummary:
      "A constitutional amendment limiting House members to a fixed number of terms and Senators to two — U.S. Term Limits v. Thornton means statute isn't enough.",
    goals: [
      {
        title: "Congressional amendment (3 House / 2 Senate terms)",
        summary:
          "The standard H.J.Res. text introduced each Congress; needs two-thirds of both chambers.",
      },
      {
        title: "Article V convention applications",
        summary:
          "U.S. Term Limits' state-by-state campaign for a term-limits-only convention.",
        status: "CONTESTED",
      },
      {
        title: "State legislator pledge program",
        summary:
          "Get state legislators on record supporting applications before each session.",
      },
    ],
    posts: [
      {
        by: "dan_oconnell",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 20,
        title: "Why Thornton (1995) forces the amendment route",
        body: "The Supreme Court held 5-4 that states can't add qualifications for congressional office — which is why every statutory shortcut fails. Amendment or nothing.\nhttps://supreme.justia.com/cases/federal/us/514/779/",
      },
      {
        by: "ruth_b",
        type: "QUESTION",
        ageDays: 7,
        title: "Does the political-science evidence actually support term limits?",
        body: "State legislature studies (California, Michigan) show mixed effects — more turnover but also more lobbyist influence over inexperienced members. How do we answer that honestly?",
      },
    ],
  });

  await starterBoard({
    slug: "end-gerrymandering",
    name: "End Gerrymandering / Independent Redistricting",
    description:
      "Voters should choose their politicians, not the other way around.",
    purpose: "End partisan gerrymandering nationwide",
    purposeSummary:
      "Independent commissions or enforceable fairness standards in every state, for congressional and legislative maps alike.",
    goals: [
      {
        title: "Independent commissions in every state",
        summary:
          "The Arizona/California/Michigan model: citizen commissions with partisan-balance rules draw the maps.",
        status: "RATIFIED",
      },
      {
        title: "Federal fairness standards",
        summary:
          "Freedom to Vote Act-style ban on partisan gerrymandering with judicial review, since Rucho closed the federal courts' door.",
      },
      {
        title: "State constitutional litigation",
        summary:
          "Post-Rucho, state courts (PA, NC, NY) are the active battleground — support state-level fair-maps clauses and cases.",
      },
    ],
    posts: [
      {
        by: "priya_s",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 16,
        title: "Princeton Gerrymandering Project report cards",
        body: "Grades every state's current maps and tracks reform status — the fastest way to see where a commission campaign is viable.\nhttps://gerrymander.princeton.edu/",
      },
      {
        by: "marcus_w",
        type: "PROBLEM",
        goalIndex: 2,
        ageDays: 9,
        title: "Ohio shows commissions can be captured — the 2021-22 cycle",
        body: "Ohio's commission ignored seven state supreme court rulings and ran out the clock. Lesson: commission design needs enforcement teeth (map-drawing defaults to courts on failure), not just existence.",
      },
      {
        by: "jkim",
        ageDays: 5,
        title: "2026 ballot initiative targets",
        body: "Which states have both initiative processes and gerrymandered maps? Preliminary list: Florida (strengthening), Missouri (restoring), Arkansas, North Dakota, South Dakota. Anyone on the ground in these?",
      },
    ],
  });

  await starterBoard({
    slug: "right-to-repair",
    name: "Right to Repair",
    description:
      "If you bought it, you should be able to fix it — parts, tools, manuals, and diagnostics for everyone.",
    purpose: "Guarantee the right to repair everything you own",
    purposeSummary:
      "Manufacturers must make parts, tools, documentation, and firmware access available to owners and independent shops on fair terms.",
    goals: [
      {
        title: "Strong state right-to-repair laws",
        summary:
          "Build on New York, Minnesota, California, Colorado, and Oregon — and close their carve-outs (parts pairing, enterprise gear).",
        status: "RATIFIED",
      },
      {
        title: "Federal REPAIR Act for vehicles",
        summary:
          "Guarantee owner access to telematics and diagnostic data as cars go fully connected.",
      },
      {
        title: "FTC enforcement against repair restrictions",
        summary:
          "The Nixing the Fix report gave the FTC a roadmap — push for cases against warranty-void stickers and parts pairing.",
      },
    ],
    posts: [
      {
        by: "jkim",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 18,
        title: "iFixit/PIRG state legislation tracker",
        body: "Live map of right-to-repair bills by state and sector (electronics, ag equipment, wheelchairs, autos).\nhttps://www.repair.org/stand-up",
      },
      {
        by: "sam_delgado",
        type: "PROBLEM",
        goalIndex: 0,
        ageDays: 11,
        title: "Parts pairing is the new lock — Oregon SB 1596 is the model answer",
        body: "Serialized parts that refuse to work after swaps defeat repair even when parts are available. Oregon's 2024 law is the first to ban the practice; every future state bill needs that language.",
      },
      {
        by: "ava_quinn",
        type: "DISCUSSION",
        goalIndex: 1,
        ageDays: 4,
        title: "Farm equipment: is the Deere MOU worth anything?",
        body: "The AFBF-John Deere memorandum promised access but has no enforcement mechanism and blocks farm bureaus from supporting legislation. Colorado went ahead and passed an ag repair law anyway. Treat MOUs as delay tactics?",
      },
    ],
  });

  await starterBoard({
    slug: "prescription-drug-price-reform",
    name: "Prescription Drug Price Reform",
    description:
      "Americans pay 2-3x what other wealthy countries pay for the same drugs. Fixing that.",
    purpose: "Make prescription drugs affordable for every American",
    purposeSummary:
      "No one should ration insulin or skip a course of treatment over price. Negotiation, competition, and transparency across the supply chain.",
    goals: [
      {
        title: "Expand Medicare price negotiation",
        summary:
          "The IRA covers a first tranche of drugs; expand the list faster and extend negotiated prices beyond Medicare.",
        status: "RATIFIED",
      },
      {
        title: "End patent thickets and pay-for-delay",
        summary:
          "Curb evergreening and settlements that keep generics off the market for years past the original patent.",
      },
      {
        title: "PBM transparency and reform",
        summary:
          "Require pass-through of rebates and disclose spread pricing by pharmacy benefit managers.",
      },
    ],
    posts: [
      {
        by: "ruth_b",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 13,
        title: "KFF tracker: the first 10 negotiated drugs and what changes in 2026",
        body: "Prices announced in August 2024 take effect January 2026 — savings estimates and the next selection round timeline.\nhttps://www.kff.org/medicare/issue-brief/faqs-about-the-inflation-reduction-acts-medicare-drug-price-negotiation-program/",
      },
      {
        by: "priya_s",
        type: "PROBLEM",
        goalIndex: 1,
        ageDays: 7,
        title: "Humira's patent thicket: 132 patents, 9 years of delay",
        body: "AbbVie's playbook — file overlapping patents on formulation, dosing, and manufacturing — kept biosimilars out until 2023 despite the main patent expiring in 2016. I-MAK's report is the best documentation.",
      },
    ],
  });

  await starterBoard({
    slug: "civil-asset-forfeiture-reform",
    name: "Civil Asset Forfeiture Reform",
    description:
      "Police shouldn't be able to take and keep property from people never convicted — or even charged — with a crime.",
    purpose: "End policing for profit through civil forfeiture",
    purposeSummary:
      "Require a criminal conviction before forfeiture, remove the profit incentive, and close the federal loophole that lets agencies bypass state reforms.",
    goals: [
      {
        title: "Conviction requirement in every state",
        summary:
          "Follow New Mexico, Nebraska, and Maine: no conviction, no forfeiture.",
        status: "RATIFIED",
      },
      {
        title: "Close the equitable-sharing loophole",
        summary:
          "Federal 'adoption' lets local agencies route seizures around state law and keep up to 80% — the FAIR Act would end it.",
      },
      {
        title: "Full transparency reporting",
        summary:
          "Every seizure, its outcome, and where the money went, published annually in every state.",
      },
    ],
    posts: [
      {
        by: "dan_oconnell",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 15,
        title: "Institute for Justice 'Policing for Profit' report (3rd edition)",
        body: "Grades all 50 states' forfeiture laws and documents $68.8B in forfeitures over 20 years. The standard citation for every hearing.\nhttps://ij.org/report/policing-for-profit-3/",
      },
      {
        by: "lena_ortiz",
        type: "DISCUSSION",
        goalIndex: 1,
        ageDays: 6,
        title: "New Mexico ended forfeiture in 2015 — did the sky fall?",
        body: "Crime trends in NM tracked neighboring states after abolition; the 'essential law enforcement tool' argument keeps failing empirically. Compiling the studies for legislator packets — drop links if you have them.",
      },
    ],
  });

  await starterBoard({
    slug: "government-transparency-foia",
    name: "Government Transparency & FOIA Modernization",
    description:
      "Public records belong to the public — fixing the backlogs, exemption abuse, and fees that keep them hidden.",
    purpose: "Make government records genuinely public by default",
    purposeSummary:
      "FOIA that works: fast, free for public-interest requests, narrow exemptions, and proactive disclosure so most records never need a request.",
    goals: [
      {
        title: "Fund and staff FOIA offices to end backlogs",
        summary:
          "Median response times keep growing; some agencies run multi-year backlogs that outlast the news value of any request.",
      },
      {
        title: "Proactive disclosure by default",
        summary:
          "Frequently requested records, contracts, and calendars published automatically in machine-readable form.",
        status: "RATIFIED",
      },
      {
        title: "Rein in Exemption 5 (deliberative process)",
        summary:
          "The 'withhold it because we can' exemption — add a foreseeable-harm test with teeth and a 25-year sunset.",
      },
    ],
    posts: [
      {
        by: "lena_ortiz",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 17,
        title: "FOIA.gov annual report data: backlog hits record high",
        body: "Government-wide backlog data by agency — DHS alone accounts for over half. Sortable numbers for advocacy one-pagers.\nhttps://www.foia.gov/data.html",
      },
      {
        by: "ava_quinn",
        type: "QUESTION",
        goalIndex: 2,
        ageDays: 5,
        title: "Did the 2016 foreseeable-harm standard change anything in practice?",
        body: "The FOIA Improvement Act required agencies to show foreseeable harm before withholding, but courts apply it unevenly. Anyone tracking post-2016 Exemption 5 win rates?",
      },
    ],
  });

  await starterBoard({
    slug: "federal-data-privacy",
    name: "Federal Data Privacy Legislation",
    description:
      "One strong national privacy law instead of a patchwork the biggest companies can arbitrage.",
    purpose: "Pass a strong comprehensive federal privacy law",
    purposeSummary:
      "Data minimization by default, real individual rights, and enforcement that bites — without preempting stronger state protections into oblivion.",
    goals: [
      {
        title: "Comprehensive federal bill (APRA framework)",
        summary:
          "The American Privacy Rights Act draft showed bipartisan appetite; the fight is preemption and private right of action.",
      },
      {
        title: "Data minimization as the default rule",
        summary:
          "Collect only what the service requires — consent pop-ups are a failed model.",
        status: "RATIFIED",
      },
      {
        title: "Private right of action",
        summary:
          "Individuals must be able to sue; FTC-only enforcement can't scale to the whole economy.",
        status: "CONTESTED",
      },
      {
        title: "Protect kids without breaking encryption",
        summary:
          "Age-appropriate design rules that don't mandate age verification or client-side scanning.",
      },
    ],
    posts: [
      {
        by: "priya_s",
        type: "RESOURCE",
        goalIndex: 0,
        ageDays: 19,
        title: "IAPP comparison: APRA vs. state privacy laws",
        body: "Side-by-side of the federal draft against California/Colorado/Connecticut — where APRA is stronger and where preemption would lose ground.\nhttps://iapp.org/resources/article/us-federal-privacy-legislation-tracker/",
      },
      {
        by: "ruth_b",
        type: "PROBLEM",
        goalIndex: 2,
        ageDays: 8,
        title: "The private-right-of-action deadlock has killed every federal bill",
        body: "Industry accepts a federal standard only with full preemption and no PRA; consumer groups accept preemption only with a PRA. APRA's compromise (delayed PRA, arbitration limits) satisfied neither. Is there a third structure — state-AG certification, statutory damages caps?",
      },
      {
        by: "jkim",
        ageDays: 3,
        title: "Nineteen states and counting — is the patchwork now our leverage?",
        body: "Every new state law raises compliance costs and makes industry more willing to deal federally. Maybe the strategy IS passing strong state laws until a good federal deal beats the patchwork.",
        type: "STRATEGY",
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    boards: await prisma.board.count(),
    nodes: await prisma.treeNode.count(),
    links: await prisma.nodeLink.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    votes: await prisma.vote.count(),
  };
  console.log("Seed complete:", counts);
  console.log('All seed users have password "lioness123".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
