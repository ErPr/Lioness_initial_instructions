import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getTreeViewData } from "@/lib/treeQuery";
import TreeCanvas from "@/components/tree/TreeCanvas";

export const dynamic = "force-dynamic";

export default async function TreePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ node?: string; all?: string }>;
}) {
  const { slug } = await params;
  const { node: initialNodeId, all } = await searchParams;
  const showAll = all === "1";
  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) notFound();

  const data = await getTreeViewData(board, user?.id, showAll);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {board.name} — goal tree
          </h1>
          <p className="text-sm text-muted">
            The working plan: the top-voted ideas hold each branch of the
            board, and the rest wait in candidate pools.
            {user
              ? " Click any card to open its links and discussion; expand for editing."
              : " Log in to vote and edit the tree."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={showAll ? `/b/${slug}/tree` : `/b/${slug}/tree?all=1`}
            className={`rounded border px-3 py-1.5 text-sm ${
              showAll
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-surface hover:border-accent hover:text-accent"
            }`}
          >
            {showAll ? "✓ Showing all candidates" : "Show all candidates"}
          </Link>
          <Link
            href={`/b/${slug}`}
            className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            ← Forum view
          </Link>
        </div>
      </div>

      {data.layout.instances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          This board&apos;s tree is empty.
        </div>
      ) : (
        <TreeCanvas
          data={data}
          boardId={board.id}
          boardSlug={slug}
          loggedIn={!!user}
          initialNodeId={initialNodeId}
        />
      )}
    </div>
  );
}
