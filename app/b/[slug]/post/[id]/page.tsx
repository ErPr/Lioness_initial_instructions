import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getScores } from "@/lib/scores";
import { timeAgo } from "@/lib/format";
import { TIER_LABELS, type Tier } from "@/lib/types";
import TypeBadge from "@/components/TypeBadge";
import VoteWidget from "@/components/VoteWidget";
import CommentForm from "@/components/CommentForm";
import CommentThread, { type CommentView } from "@/components/CommentThread";
import DeletePostButton from "@/components/DeletePostButton";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const user = await getCurrentUser();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      board: {
        include: {
          nodes: {
            where: { status: { not: "ARCHIVED" } },
            orderBy: { title: "asc" },
            select: { id: true, title: true, tier: true },
          },
        },
      },
      author: { select: { username: true } },
      treeNode: { select: { id: true, title: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { username: true } },
          treeNode: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!post || post.board.slug !== slug || post.deletedAt) notFound();

  const postScore = (await getScores("POST", [post.id], user?.id)).get(post.id)!;
  const commentScores = await getScores(
    "COMMENT",
    post.comments.map((c) => c.id),
    user?.id
  );

  // Build the thread tree.
  const byId = new Map<string, CommentView>();
  for (const c of post.comments) {
    byId.set(c.id, {
      id: c.id,
      author: c.author.username,
      body: c.body,
      contributionType: c.contributionType,
      when: timeAgo(c.createdAt),
      deleted: !!c.deletedAt,
      isMine: !!user && c.authorId === user.id,
      treeNode: c.treeNode,
      score: commentScores.get(c.id)?.score ?? 0,
      myVote: commentScores.get(c.id)?.myVote ?? 0,
      children: [],
    });
  }
  const roots: CommentView[] = [];
  for (const c of post.comments) {
    const view = byId.get(c.id)!;
    const parent = c.parentCommentId ? byId.get(c.parentCommentId) : undefined;
    if (parent) parent.children.push(view);
    else roots.push(view);
  }
  // Hide deleted leaf comments (keep deleted ones that hold replies).
  const prune = (list: CommentView[]): CommentView[] =>
    list
      .map((c) => ({ ...c, children: prune(c.children) }))
      .filter((c) => !c.deleted || c.children.length > 0);
  const thread = prune(roots);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="text-xs text-muted">
        <Link href={`/b/${slug}`} className="hover:text-accent">
          ← {post.board.name}
        </Link>
      </div>

      <article className="flex gap-3 rounded-lg border border-line bg-surface p-4">
        <VoteWidget
          targetType="POST"
          targetId={post.id}
          score={postScore.score}
          myVote={postScore.myVote}
          loggedIn={!!user}
          revalidate={`/b/${slug}/post/${id}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold">{post.title}</h1>
            <TypeBadge type={post.contributionType} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>
              {post.author.username} · {timeAgo(post.createdAt)}
            </span>
            {post.treeNode && (
              <Link
                href={`/b/${slug}/tree?node=${post.treeNode.id}`}
                className="rounded bg-accent-soft px-1.5 py-px text-accent hover:underline"
              >
                ⤷ attached to {post.treeNode.title}
              </Link>
            )}
            {post.proposesNode && post.proposedTitle && (
              <span className="rounded border border-dashed border-accent px-1.5 py-px text-accent">
                proposes {TIER_LABELS[post.proposedTier as Tier] ?? post.proposedTier}
                : {post.proposedTitle}
              </span>
            )}
            {user && post.authorId === user.id && (
              <DeletePostButton postId={post.id} />
            )}
          </div>
          {post.body && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {post.body}
            </p>
          )}
        </div>
      </article>

      <section className="flex flex-col gap-3">
        {user ? (
          <CommentForm postId={post.id} nodes={post.board.nodes} />
        ) : (
          <p className="text-sm text-muted">
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>{" "}
            to comment.
          </p>
        )}
        <CommentThread
          comments={thread}
          postId={post.id}
          boardSlug={slug}
          nodes={post.board.nodes}
          loggedIn={!!user}
        />
      </section>
    </div>
  );
}
