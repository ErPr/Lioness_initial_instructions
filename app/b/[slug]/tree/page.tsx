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
  searchParams: Promise<{ node?: string }>;
}) {
  const { slug } = await params;
  const { node: initialNodeId } = await searchParams;
  const user = await getCurrentUser();

  const board = await prisma.board.findUnique({ where: { slug } });
  if (!board) notFound();

  const data = await getTreeViewData(board.id, slug, user?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {board.name} — goal tree
          </h1>
          <p className="text-sm text-muted">
            The same conversation as the forum, rendered as a living roadmap.
            {user
              ? " Click any card to open its links and discussion; expand for editing."
              : " Log in to vote and edit the tree."}
          </p>
        </div>
        <Link
          href={`/b/${slug}`}
          className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
        >
          ← Forum view
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
