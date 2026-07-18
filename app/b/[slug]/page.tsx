import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getScores } from "@/lib/scores";
import { timeAgo } from "@/lib/format";
import { TIER_LABELS, type Tier } from "@/lib/types";
import PostForm from "@/components/PostForm";
import TypeBadge from "@/components/TypeBadge";
import VoteWidget from "@/components/VoteWidget";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const { sort = "new" } = await searchParams;
  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({
    where: { slug },
    include: {
      nodes: {
        where: { status: { not: "ARCHIVED" } },
        orderBy: { title: "asc" },
        select: { id: true, title: true, tier: true },
      },
    },
  });
  if (!board) notFound();

  const posts = await prisma.post.findMany({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { username: true } },
      treeNode: { select: { id: true, title: true } },
      _count: { select: { comments: { where: { deletedAt: null } } } },
    },
  });

  const scores = await getScores(
    "POST",
    posts.map((p) => p.id),
    user?.id
  );
  const sorted =
    sort === "top"
      ? [...posts].sort(
          (a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0)
        )
      : posts;

  const sortLink = (s: string, label: string) => (
    <Link
      href={`/b/${slug}?sort=${s}`}
      className={
        sort === s ? "font-semibold text-accent" : "text-muted hover:text-foreground"
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{board.name}</h1>
          <p className="text-sm text-muted">{board.description}</p>
        </div>
        <Link
          href={`/b/${slug}/tree`}
          className="rounded border border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-white"
        >
          View goal tree →
        </Link>
      </div>

      {user ? (
        <PostForm boardSlug={slug} nodes={board.nodes} />
      ) : (
        <p className="rounded border border-line bg-surface p-3 text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>{" "}
          to post.
        </p>
      )}

      <div className="flex gap-3 border-b border-line pb-2 text-sm">
        {sortLink("new", "New")}
        {sortLink("top", "Top")}
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          No posts yet — be the first.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sorted.map((p) => {
            const s = scores.get(p.id) ?? { score: 0, myVote: 0 };
            return (
              <li key={p.id} className="flex gap-3 py-2.5">
                <VoteWidget
                  targetType="POST"
                  targetId={p.id}
                  score={s.score}
                  myVote={s.myVote}
                  loggedIn={!!user}
                  revalidate={`/b/${slug}`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/b/${slug}/post/${p.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {p.title}
                    </Link>
                    <TypeBadge type={p.contributionType} />
                    {p.treeNode && (
                      <Link
                        href={`/b/${slug}/tree?node=${p.treeNode.id}`}
                        className="rounded bg-accent-soft px-1.5 py-px text-[11px] text-accent hover:underline"
                      >
                        ⤷ {p.treeNode.title}
                      </Link>
                    )}
                    {p.proposesNode && p.proposedTitle && (
                      <span className="rounded border border-dashed border-accent px-1.5 py-px text-[11px] text-accent">
                        proposes{" "}
                        {TIER_LABELS[p.proposedTier as Tier] ?? p.proposedTier}:{" "}
                        {p.proposedTitle}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {p.author.username} · {timeAgo(p.createdAt)} ·{" "}
                    <Link
                      href={`/b/${slug}/post/${p.id}`}
                      className="hover:text-foreground"
                    >
                      {p._count.comments}{" "}
                      {p._count.comments === 1 ? "comment" : "comments"}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
