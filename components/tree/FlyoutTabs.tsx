"use client";

import { useState } from "react";
import Link from "next/link";
import TypeBadge from "@/components/TypeBadge";
import VoteWidget from "@/components/VoteWidget";
import { TIER_LABELS, type Tier } from "@/lib/types";
import type { FlyoutRow, NodeView } from "@/lib/treeQuery";

type TabKey = "links" | "support" | "news";

const TABS: { key: TabKey; label: string }[] = [
  { key: "links", label: "Top Links" },
  { key: "support", label: "Support" },
  { key: "news", label: "News/Trending" },
];

/**
 * The three flyout tabs. All tabs are different sorts/filters over the same
 * attached posts & comments; rows are votable inline.
 */
export default function FlyoutTabs({
  node,
  boardSlug,
  loggedIn,
  onOpenNode,
  maxRows,
}: {
  node: NodeView;
  boardSlug: string;
  loggedIn: boolean;
  onOpenNode?: (nodeId: string) => void;
  maxRows?: number;
}) {
  const [tab, setTab] = useState<TabKey>("links");
  const treePath = `/b/${boardSlug}/tree`;

  const rows: FlyoutRow[] =
    tab === "links" ? node.topLinks : tab === "support" ? node.support : node.news;
  const shown = maxRows ? rows.slice(0, maxRows) : rows;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex border-b border-line text-xs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 font-medium ${
              tab === t.key
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">
            {tab === "links"
              ? "No resource links attached yet. Post a Resource and attach it to this node."
              : tab === "support"
                ? "No discussion attached to this node yet."
                : "Nothing trending — no recent activity on this node."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.targetType + r.id} className="flex items-center gap-2 px-3 py-2">
                <VoteWidget
                  targetType={r.targetType}
                  targetId={r.id}
                  score={r.score}
                  myVote={r.myVote}
                  loggedIn={loggedIn}
                  revalidate={treePath}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={r.href}
                    className="block truncate text-[13px] font-medium hover:text-accent"
                    title={r.title}
                  >
                    {r.title}
                  </Link>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted">
                    <TypeBadge type={r.type} />
                    <span className="truncate">{r.subtitle}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "support" && node.parents.length > 0 && (
          <div className="border-t border-line px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Serves {node.parents.length}{" "}
              {node.parents.length === 1 ? "parent" : "parents"}
            </div>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {node.parents.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpenNode?.(p.id)}
                    className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent hover:underline"
                  >
                    {TIER_LABELS[p.tier as Tier] ?? p.tier}: {p.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
