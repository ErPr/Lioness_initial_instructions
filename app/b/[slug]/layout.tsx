import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import BoardTabs from "@/components/shell/BoardTabs";
import JoinButton from "@/components/shell/JoinButton";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const board = await prisma.board.findUnique({
    where: { slug },
    include: { _count: { select: { memberships: true } } },
  });
  if (!board) notFound();

  const joined = user
    ? !!(await prisma.membership.findUnique({
        where: { userId_boardId: { userId: user.id, boardId: board.id } },
      }))
    : false;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {board.name}
            </h1>
            {board.category && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                {board.category}
              </span>
            )}
          </div>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">
            {board.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {board._count.memberships} member
            {board._count.memberships === 1 ? "" : "s"}
          </span>
          <JoinButton boardId={board.id} joined={joined} loggedIn={!!user} />
        </div>
      </div>
      <BoardTabs slug={slug} />
      <div>{children}</div>
    </div>
  );
}
