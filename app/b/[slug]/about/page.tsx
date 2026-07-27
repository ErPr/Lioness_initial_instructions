import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getScores } from "@/lib/scores";
import { getAlliesForBoard } from "@/lib/coalition";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const board = await prisma.board.findUnique({
    where: { slug },
    include: {
      _count: {
        select: {
          posts: { where: { deletedAt: null } },
          nodes: true,
          memberships: true,
        },
      },
      nodes: { where: { tier: "PURPOSE" }, take: 1 },
      memberships: {
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
        take: 24,
      },
    },
  });
  if (!board) notFound();
  const purpose = board.nodes[0];
  const purposeScore = purpose
    ? (await getScores("NODE", [purpose.id])).get(purpose.id)!.score
    : 0;

  const allies = await getAlliesForBoard(board.id);
  const statusCounts = await prisma.treeNode.groupBy({
    by: ["status"],
    where: { boardId: board.id },
    _count: true,
  });
  const sc = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {purpose && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            Purpose
          </div>
          <p className="mt-1 text-base font-medium">{purpose.title}</p>
          {purpose.summary && (
            <p className="mt-1.5 text-sm text-muted">{purpose.summary}</p>
          )}
          <div className="mt-2 text-xs text-muted">
            ▲ {purposeScore} ·{" "}
            <Link
              href={`/b/${slug}/tree?node=${purpose.id}`}
              className="text-accent hover:underline"
            >
              open in tree →
            </Link>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Members", board._count.memberships],
          ["Posts", board._count.posts],
          ["Tree nodes", board._count.nodes],
          ["Ratified", sc.RATIFIED ?? 0],
        ].map(([label, n]) => (
          <div
            key={label}
            className="rounded-lg border border-line bg-surface p-3 text-center"
          >
            <div className="text-xl font-semibold tabular-nums">{n}</div>
            <div className="text-[11px] uppercase tracking-wide text-muted">
              {label}
            </div>
          </div>
        ))}
      </section>

      <section className="text-sm text-muted">
        <span className="text-foreground">Node statuses:</span>{" "}
        {sc.RATIFIED ?? 0} ratified · {sc.PROPOSED ?? 0} proposed ·{" "}
        {sc.CONTESTED ?? 0} contested
        {sc.ARCHIVED ? ` · ${sc.ARCHIVED} archived` : ""} — statuses and board
        seats are decided by votes, automatically. Created{" "}
        {timeAgo(board.createdAt)}.
      </section>

      {allies.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Potential allies
          </div>
          <div className="flex flex-col gap-2">
            {allies.map((a) => (
              <div
                key={a.other.id}
                className="rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                <div className="flex items-baseline gap-2">
                  <Link
                    href={`/b/${a.other.slug}`}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {a.other.name}
                  </Link>
                  <span className="ml-auto text-[11px] text-muted">
                    {a.bridgeCount} shared{" "}
                    {a.bridgeCount === 1 ? "effort" : "efforts"}
                  </span>
                </div>
                {a.topBridge && (
                  <p className="mt-0.5 truncate text-xs text-muted">
                    e.g. “{a.topBridge.a.title}” ⇄ “{a.topBridge.b.title}”
                  </p>
                )}
              </div>
            ))}
            <Link
              href="/coalitions"
              className="px-1 text-xs text-accent hover:underline"
            >
              Full coalition graph →
            </Link>
          </div>
        </section>
      )}

      {board.memberships.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
            Members
          </div>
          <div className="flex flex-wrap gap-1.5">
            {board.memberships.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs"
              >
                {m.user.username}
              </span>
            ))}
            {board._count.memberships > board.memberships.length && (
              <span className="px-1 text-xs text-muted">
                +{board._count.memberships - board.memberships.length} more
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
