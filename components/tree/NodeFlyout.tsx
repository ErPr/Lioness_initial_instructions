"use client";

import VoteWidget from "@/components/VoteWidget";
import FlyoutTabs from "@/components/tree/FlyoutTabs";
import type { NodeView } from "@/lib/treeQuery";

/**
 * Transient panel anchored to a node card. The parent canvas owns open/close
 * behavior (outside click, Escape, one-at-a-time); this renders the content.
 */
export default function NodeFlyout({
  node,
  boardSlug,
  loggedIn,
  onExpand,
  onOpenNode,
  style,
}: {
  node: NodeView;
  boardSlug: string;
  loggedIn: boolean;
  onExpand: () => void;
  onOpenNode: (nodeId: string) => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      data-flyout
      style={style}
      className="absolute z-30 flex max-h-96 w-80 flex-col rounded-lg border border-line bg-surface shadow-lg"
    >
      <div className="flex items-start gap-2 border-b border-line px-3 py-2">
        <VoteWidget
          targetType="NODE"
          targetId={node.id}
          score={node.score}
          myVote={node.myVote}
          loggedIn={loggedIn}
          revalidate={`/b/${boardSlug}/tree`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{node.title}</div>
          {node.summary && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{node.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onExpand}
          title="Expand to full panel"
          className="rounded border border-line px-1.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
        >
          ⤢ Expand
        </button>
      </div>
      <FlyoutTabs
        node={node}
        boardSlug={boardSlug}
        loggedIn={loggedIn}
        onOpenNode={onOpenNode}
        maxRows={8}
      />
    </div>
  );
}
