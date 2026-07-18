import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import BoardForm from "@/components/BoardForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { posts: { where: { deletedAt: null } }, nodes: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Movements</h1>
          <p className="text-sm text-muted">
            Every board is a community and a goal tree — two views of the same
            conversation.
          </p>
        </div>
        {user && <BoardForm />}
      </div>

      {boards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          No boards yet.{" "}
          {user
            ? "Start the first movement above."
            : "Log in to start the first movement."}
          <div className="mt-2 text-xs">
            (Tip: run <code className="rounded bg-background px-1">npm run db:seed</code>{" "}
            to load the pilot movement set.)
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {boards.map((b) => (
            <li
              key={b.id}
              className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-accent"
            >
              <Link href={`/b/${b.slug}`} className="font-medium hover:text-accent">
                {b.name}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{b.description}</p>
              <div className="mt-2 flex gap-4 text-xs text-muted">
                <span>{b._count.posts} posts</span>
                <Link
                  href={`/b/${b.slug}/tree`}
                  className="text-accent hover:underline"
                >
                  {b._count.nodes} tree nodes →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
