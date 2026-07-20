import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getMiniMapData } from "@/lib/minimapQuery";
import { getScores } from "@/lib/scores";
import { timeAgo } from "@/lib/format";
import TreeThumb from "@/components/TreeThumb";
import TypeBadge from "@/components/TypeBadge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const memberships = user
    ? await prisma.membership.findMany({
        where: { userId: user.id },
        include: {
          board: {
            include: {
              _count: {
                select: { posts: { where: { deletedAt: null } }, nodes: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  if (user && memberships.length > 0) {
    return <MemberHome userId={user.id} memberships={memberships} />;
  }
  return <VisitorHome loggedIn={!!user} />;
}

/* ---------------- signed-in dashboard ---------------- */

async function MemberHome({
  userId,
  memberships,
}: {
  userId: string;
  memberships: Awaited<
    ReturnType<
      typeof prisma.membership.findMany<{
        include: {
          board: {
            include: {
              _count: {
                select: { posts: { where: { deletedAt: null } }; nodes: true };
              };
            };
          };
        };
      }>
    >
  >;
}) {
  const myBoardIds = memberships.map((m) => m.boardId);

  const [recentPosts, nodeActivity, suggested] = await Promise.all([
    prisma.post.findMany({
      where: { boardId: { in: myBoardIds }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        board: { select: { slug: true, name: true } },
        author: { select: { username: true } },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    }),
    prisma.nodeEditLog.findMany({
      where: {
        node: { boardId: { in: myBoardIds } },
        action: { in: ["STATUS", "CREATE", "LINK", "UNLINK", "RETIER"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        node: {
          select: {
            id: true,
            title: true,
            status: true,
            board: { select: { slug: true, name: true } },
          },
        },
        user: { select: { username: true } },
      },
    }),
    prisma.board.findMany({
      where: { id: { notIn: myBoardIds } },
      orderBy: { momentum: "desc" },
      take: 3,
      select: { slug: true, name: true, category: true, momentum: true },
    }),
  ]);
  void userId;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your movements</h1>
        <p className="text-sm text-muted">
          What changed across the {memberships.length} movement
          {memberships.length === 1 ? "" : "s"} you belong to.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Latest discussion
            </h2>
            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {recentPosts.length === 0 ? (
                <p className="p-4 text-sm text-muted">No posts yet.</p>
              ) : (
                recentPosts.map((p) => (
                  <div key={p.id} className="px-4 py-2.5">
                    <Link
                      href={`/b/${p.board.slug}`}
                      className="text-[10.5px] font-semibold uppercase tracking-wide text-accent hover:underline"
                    >
                      {p.board.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/b/${p.board.slug}/post/${p.id}`}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {p.title}
                      </Link>
                      <TypeBadge type={p.contributionType} />
                    </div>
                    <div className="text-xs text-muted">
                      {p.author.username} · {timeAgo(p.createdAt)} ·{" "}
                      {p._count.comments} comment
                      {p._count.comments === 1 ? "" : "s"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Nodes in motion
            </h2>
            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {nodeActivity.length === 0 ? (
                <p className="p-4 text-sm text-muted">No tree activity yet.</p>
              ) : (
                nodeActivity.map((e) => (
                  <div key={e.id} className="px-4 py-2">
                    <Link
                      href={`/b/${e.node.board.slug}/tree?node=${e.node.id}`}
                      className="text-[13px] font-medium hover:text-accent"
                    >
                      {e.node.title}
                    </Link>
                    <div className="text-[11px] text-muted">
                      {e.detail || e.action.toLowerCase()} · {e.node.board.name}{" "}
                      · {timeAgo(e.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
              Your boards
            </h2>
            <div className="flex flex-col gap-2">
              {memberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/b/${m.board.slug}`}
                  className="flex items-baseline gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-accent"
                >
                  <span className="min-w-0 truncate font-medium">
                    {m.board.name}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted">
                    {m.board._count.posts} posts · {m.board._count.nodes} nodes
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {suggested.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                Worth a look
              </h2>
              <div className="flex flex-col gap-2">
                {suggested.map((b) => (
                  <Link
                    key={b.slug}
                    href={`/b/${b.slug}`}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:border-accent"
                  >
                    <span className="font-medium">{b.name}</span>
                    <span className="ml-2 text-[11px] text-muted">
                      {b.category}
                      {b.momentum ? ` · momentum ${b.momentum}` : ""}
                    </span>
                  </Link>
                ))}
                <Link
                  href="/explore"
                  className="px-1 text-xs text-accent hover:underline"
                >
                  Explore all movements →
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- signed-out / new-user hero ---------------- */

async function VisitorHome({ loggedIn }: { loggedIn: boolean }) {
  const hero = await prisma.board.findFirst({
    orderBy: [{ momentum: "desc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          posts: { where: { deletedAt: null } },
          nodes: true,
          memberships: true,
        },
      },
      nodes: {
        where: { tier: "PURPOSE" },
        take: 1,
        include: { childLinks: { include: { childNode: true } } },
      },
    },
  });
  if (!hero) {
    return (
      <p className="py-16 text-center text-sm text-muted">
        No movements yet — run a seed script to load the pilot data.
      </p>
    );
  }

  const purpose = hero.nodes[0];
  const kids = purpose?.childLinks.map((l) => l.childNode) ?? [];
  const kidScores = await getScores(
    "NODE",
    kids.map((k) => k.id)
  );
  const top3 = [...kids]
    .sort(
      (a, b) =>
        (kidScores.get(b.id)?.score ?? 0) - (kidScores.get(a.id)?.score ?? 0)
    )
    .slice(0, 3);

  const [miniMap, categories] = await Promise.all([
    getMiniMapData(hero.id),
    prisma.board.groupBy({ by: ["category"], _count: true }),
  ]);
  const catBoards = await prisma.board.findMany({
    orderBy: { momentum: "desc" },
    select: { name: true, slug: true, category: true },
  });
  const digest = categories
    .filter((c) => c.category)
    .map((c) => ({
      name: c.category,
      count: c._count,
      top: catBoards.filter((b) => b.category === c.category).slice(0, 2),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-6 lg:flex-nowrap">
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">
              🔥 highest momentum right now
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">
              {hero.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {hero.description}
            </p>
            {top3.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                  Top of the working plan
                </div>
                <ul className="mt-1.5 flex flex-col gap-1 text-sm">
                  {top3.map((k, i) => (
                    <li key={k.id} className="flex gap-2">
                      <span>{["🥇", "🥈", "🥉"][i]}</span>
                      <span className="min-w-0 truncate">{k.title}</span>
                      <span className="text-xs text-muted">
                        ▲{kidScores.get(k.id)?.score ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <Link
                href={`/b/${hero.slug}`}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Enter forum
              </Link>
              <Link
                href={`/b/${hero.slug}/tree`}
                className="rounded-md border border-line bg-surface px-4 py-2 text-sm hover:border-accent hover:text-accent"
              >
                View goal tree →
              </Link>
            </div>
          </div>
          <Link
            href={`/b/${hero.slug}/tree`}
            className="shrink-0 rounded-lg border border-line bg-background p-3"
            title="Open the goal tree"
          >
            <TreeThumb data={miniMap} width={380} height={210} />
          </Link>
        </div>
      </section>

      <p className="text-center text-sm text-muted">
        A forum shows what a community <em>said</em>. Lioness shows what it{" "}
        <em>decided</em> — every conversation is also a living goal tree,
        ranked and ratified by votes.
        {!loggedIn && (
          <>
            {" "}
            <Link href="/register" className="text-accent hover:underline">
              Create an account
            </Link>{" "}
            to join movements.
          </>
        )}
      </p>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Find your movement</h2>
          <Link href="/explore" className="text-sm text-accent hover:underline">
            Explore all →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {digest.map((c) => (
            <Link
              key={c.name}
              href={`/explore?cat=${encodeURIComponent(c.name)}`}
              className="rounded-lg border border-line bg-surface p-3.5 hover:border-accent"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-muted">{c.count}</span>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {c.top.map((t) => t.name).join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
