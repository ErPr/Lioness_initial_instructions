import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import ExploreView from "@/components/ExploreView";
import BoardForm from "@/components/BoardForm";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const user = await getCurrentUser();
  const boards = await prisma.board.findMany({
    include: {
      _count: {
        select: {
          posts: { where: { deletedAt: null } },
          nodes: true,
          memberships: true,
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Explore</h1>
          <p className="text-sm text-muted">
            Every movement on Lioness — search, browse by category, or see the
            whole landscape at once.
          </p>
        </div>
        {user && <BoardForm />}
      </div>
      <ExploreView
        initialCategory={cat}
        boards={boards.map((b) => ({
          slug: b.slug,
          name: b.name,
          description: b.description,
          category: b.category,
          momentum: b.momentum,
          importance: b.importance,
          posts: b._count.posts,
          nodes: b._count.nodes,
          members: b._count.memberships,
        }))}
      />
    </div>
  );
}
