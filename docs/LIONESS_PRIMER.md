# Lioness — a primer

*A portable overview for exploring the idea. Self-contained: assumes no prior context.*

## What it is

Lioness is a platform for civic movements where **a forum and a visual "goal tree" are two views of the same data**. The tagline that captures it: *Reddit shows what a community said; Lioness shows what it decided.*

Most online organizing scatters across Reddit threads, group chats, Discords, and Google Docs. Discussion happens, but it evaporates — there's no durable, shared answer to "what is this movement actually trying to do, in what order, and what's the evidence?" Lioness's bet is that the missing layer isn't more discussion; it's **structure that turns discussion into a living plan**.

## The core mechanic: the goal tree

Every movement has one tree — a map of its strategy, organized into tiers:

**Purpose → Root Issues → Goals → Strategies → Tactics → Actions**

- It's a graph, not a strict hierarchy: a tactic can serve more than one goal.
- Nodes are voted on by the community. A **"working plan"** rule keeps the tree readable: only the top-voted few ideas hold each branch; the rest wait in a visible "candidate pool" until they earn their spot. So the tree always shows the community's *current best plan*, not every idea ever proposed.
- Node status is automatic from votes: **proposed → ratified** (clear support) or **contested** (meaningful disagreement). No moderators needed.

The forum and the tree are linked: a discussion can attach to a node, and evidence (links, articles, data) lives on the node it supports.

## The differentiator: the collective-mind capture pipeline

The newest and most distinctive piece. Members feed the movement from their phones:

1. **Share anything** — an article, a tweet, a TikTok, a screenshot — to Lioness from the phone share sheet. It lands in a **private inbox**.
2. **AI enriches and routes it** — pulls the metadata, then proposes *which node on which movement's tree* this is evidence for.
3. **One tap confirms it** — nothing becomes public until the person confirms. Then it becomes real, votable evidence on that node.
4. **A heat map lights up** — nodes glow based on how much recent attention (shared evidence) is flowing to them, so you can see where the collective mind is pointing right now.

The insight: people already share civic content constantly, into feeds where it disappears. Lioness captures that firehose and **routes it into structure** instead of a timeline.

## How it's different from neighbors

- **vs. Reddit / forums:** they optimize for conversation and recency; Lioness optimizes for a durable, decided plan. Discussion is an input, not the product.
- **vs. Pol.is** (the closest civic-tech tool): Pol.is *maps what a population thinks and finds consensus* — it's a sensing instrument that stops where action begins. Lioness picks up there: it's the *coordination layer* that turns agreement into a structured, evidenced plan that outlives the conversation. They're arguably complementary — a Pol.is conversation could seed a Lioness movement's root issues.
- **vs. Google Docs / Notion:** those are unstructured and don't vote, rank, or aggregate a crowd's judgment.

## Where it stands

A working prototype exists (Next.js web app): accounts, movements, the forum, the full goal tree with voting and the working-plan mechanic, ~130 real movements imported from a civic-issue atlas (money in politics, gerrymandering, right-to-repair, surveillance reform, etc.), the capture pipeline end-to-end (share → enrich → AI-route → confirm → evidence on the tree), and the attention heat map. It runs; it's demoable.

## Open questions worth exploring

- **Adoption / cold start:** a movement platform is worthless empty. What's the wedge — one movement? one city? riding an existing community?
- **Business model & who pays:** nonprofits? foundations? a civic SaaS? Is it a product or a public good?
- **Faction awareness:** borrowing from Pol.is — showing *how a movement splits* on a contested node, not just a net score.
- **Governance:** currently fully automatic (votes decide everything). When, if ever, do you want trusted stewards or roles?
- **Trust & manipulation:** how do you keep brigading, astroturfing, and bad-faith capture from poisoning the tree?
- **The "so what" loop:** once a movement has a great plan, how does Lioness help it actually *act* — turnout, contacting reps, real-world outcomes?
- **Positioning:** is Lioness a tool, a movement, a protocol, or infrastructure others build on?

## One-sentence pitch

*Lioness turns the scattered firehose of civic conversation into a living, evidenced, community-decided plan of action — a shared map of what a movement is trying to do and why.*
