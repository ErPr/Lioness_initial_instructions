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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          The working plan: top-voted ideas hold each branch; the rest wait in
          candidate pools.
          {user ? "" : " Log in to vote and edit the tree."}
        </p>
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
