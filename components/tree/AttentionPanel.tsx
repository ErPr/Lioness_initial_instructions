import Link from "next/link";
import { getTopAttention } from "@/lib/heat";
import { TIER_LABELS, type Tier } from "@/lib/types";

const DOT: Record<number, string> = {
  1: "bg-amber-300",
  2: "bg-orange-400",
  3: "bg-orange-500",
  4: "bg-orange-600",
};

// A compact "where attention is flowing" readout for one board: the hottest
// nodes by recent captured evidence. Server component — reads live heat.
export default async function AttentionPanel({ boardId }: { boardId: string }) {
  const top = await getTopAttention({ boardId, limit: 5 });
  if (top.length === 0) return null;

  return (
    <aside className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden>🔥</span>
        <h2 className="text-sm font-semibold">Where attention is flowing</h2>
        <span className="text-[11px] text-muted">last 7 days</span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {top.map((e) => (
          <li key={e.nodeId} className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.level] ?? "bg-stone-300"}`}
              aria-hidden
            />
            <Link
              href={`/b/${e.boardSlug}/tree?node=${e.nodeId}`}
              className="min-w-0 flex-1 truncate hover:text-accent"
              title={e.title}
            >
              {e.title}
            </Link>
            <span className="shrink-0 text-[11px] text-muted">
              {TIER_LABELS[e.tier as Tier] ?? e.tier}
            </span>
            <span
              className="shrink-0 text-[11px] text-orange-500"
              title={`${e.heat.shares} shared items · ${e.heat.count} sources`}
            >
              {e.heat.shares}×
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
