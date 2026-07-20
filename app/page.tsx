import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import BoardForm from "@/components/BoardForm";
import BoardDirectory from "@/components/BoardDirectory";

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
            or <code className="rounded bg-background px-1">npm run db:seed:atlas</code>{" "}
            to load a pilot movement set.)
          </div>
        </div>
      ) : (
        <BoardDirectory
          boards={boards.map((b) => ({
            slug: b.slug,
            name: b.name,
            description: b.description,
            category: b.category,
            posts: b._count.posts,
            nodes: b._count.nodes,
          }))}
        />
      )}
    </div>
  );
}
