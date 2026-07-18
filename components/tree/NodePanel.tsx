"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import VoteWidget from "@/components/VoteWidget";
import FlyoutTabs from "@/components/tree/FlyoutTabs";
import {
  createNode,
  linkNodes,
  unlinkNodes,
  updateNode,
} from "@/lib/actions/tree";
import {
  NODE_STATUSES,
  TIER_LABELS,
  TIER_RANK,
  TIERS,
  type Tier,
} from "@/lib/types";
import type { NodeRef, NodeView } from "@/lib/treeQuery";

const inputCls =
  "w-full rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

const STATUS_DOT: Record<string, string> = {
  PROPOSED: "bg-stone-400",
  RATIFIED: "bg-amber-600",
  CONTESTED: "bg-red-500",
  ARCHIVED: "bg-stone-300",
};

/** Full side panel: node details, tabs, editing, link management, edit log. */
export default function NodePanel({
  node,
  boardId,
  boardSlug,
  allNodes,
  loggedIn,
  onClose,
  onOpenNode,
}: {
  node: NodeView;
  boardId: string;
  boardSlug: string;
  allNodes: NodeRef[];
  loggedIn: boolean;
  onClose: () => void;
  onOpenNode: (nodeId: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [addingParent, setAddingParent] = useState(false);
  const treePath = `/b/${boardSlug}/tree`;

  function run(fn: () => Promise<{ error?: string }>, done?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        done?.();
        router.refresh();
      }
    });
  }

  const isRoot = node.tier === "PURPOSE";

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-xl">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <VoteWidget
          targetType="NODE"
          targetId={node.id}
          score={node.score}
          myVote={node.myVote}
          loggedIn={loggedIn}
          revalidate={treePath}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
            <span>{TIER_LABELS[node.tier as Tier] ?? node.tier}</span>
            <span
              className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[node.status] ?? ""}`}
            />
            <span>{node.status.toLowerCase()}</span>
            {node.parentCount > 1 && (
              <span className="rounded bg-accent-soft px-1 text-accent normal-case">
                appears in {node.parentCount} places
              </span>
            )}
          </div>
          <h2 className="mt-0.5 text-base font-semibold leading-tight">
            {node.title}
          </h2>
          {node.summary && !editing && (
            <p className="mt-1 text-sm text-muted">{node.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="text-lg leading-none text-muted hover:text-foreground"
        >
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <FlyoutTabs
          node={node}
          boardSlug={boardSlug}
          loggedIn={loggedIn}
          onOpenNode={onOpenNode}
        />

        {loggedIn && (
          <div className="flex flex-col gap-3 border-t border-line p-4">
            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="rounded border border-line px-2 py-1 hover:border-accent hover:text-accent"
              >
                {editing ? "Cancel edit" : "Edit node"}
              </button>
              <button
                type="button"
                onClick={() => setAddingChild((v) => !v)}
                className="rounded border border-line px-2 py-1 hover:border-accent hover:text-accent"
              >
                {addingChild ? "Cancel" : "+ Add child"}
              </button>
              {!isRoot && (
                <button
                  type="button"
                  onClick={() => setAddingParent((v) => !v)}
                  className="rounded border border-line px-2 py-1 hover:border-accent hover:text-accent"
                >
                  {addingParent ? "Cancel" : "+ Link parent"}
                </button>
              )}
            </div>

            {editing && (
              <form
                className="flex flex-col gap-2 rounded border border-line bg-background p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(
                    () =>
                      updateNode({
                        nodeId: node.id,
                        title: String(fd.get("title")),
                        summary: String(fd.get("summary")),
                        tier: String(fd.get("tier")),
                        status: String(fd.get("status")),
                        revalidate: treePath,
                      }),
                    () => setEditing(false)
                  );
                }}
              >
                <input name="title" defaultValue={node.title} className={inputCls} />
                <textarea
                  name="summary"
                  defaultValue={node.summary}
                  rows={2}
                  placeholder="Summary"
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <select
                    name="tier"
                    defaultValue={node.tier}
                    disabled={isRoot}
                    className={inputCls}
                  >
                    {TIERS.filter((t) => (isRoot ? true : t !== "PURPOSE")).map(
                      (t) => (
                        <option key={t} value={t}>
                          {TIER_LABELS[t]}
                        </option>
                      )
                    )}
                  </select>
                  <select name="status" defaultValue={node.status} className={inputCls}>
                    {NODE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="self-start rounded bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Save changes
                </button>
                <p className="text-[11px] text-muted">
                  Tiers are soft — re-tiering is allowed whenever it doesn&apos;t
                  invert an existing parent/child link. Archiving hides the node
                  from the tree. All edits are logged.
                </p>
              </form>
            )}

            {addingChild && (
              <form
                className="flex flex-col gap-2 rounded border border-line bg-background p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(
                    () =>
                      createNode({
                        boardId,
                        tier: String(fd.get("tier")),
                        title: String(fd.get("title")),
                        summary: String(fd.get("summary")),
                        parentNodeId: node.id,
                        revalidate: treePath,
                      }),
                    () => setAddingChild(false)
                  );
                }}
              >
                <div className="text-xs font-medium">New child of “{node.title}”</div>
                <input name="title" required placeholder="Title" className={inputCls} />
                <textarea
                  name="summary"
                  rows={2}
                  placeholder="Summary (optional)"
                  className={inputCls}
                />
                <select
                  name="tier"
                  className={inputCls}
                  defaultValue={
                    TIERS[
                      Math.min(TIER_RANK[node.tier as Tier] + 1, TIERS.length - 1)
                    ]
                  }
                >
                  {TIERS.filter(
                    (t) => TIER_RANK[t] >= TIER_RANK[node.tier as Tier] && t !== "PURPOSE"
                  ).map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isPending}
                  className="self-start rounded bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Create child node
                </button>
              </form>
            )}

            {addingParent && (
              <form
                className="flex flex-col gap-2 rounded border border-line bg-background p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const parentNodeId = String(fd.get("parentNodeId"));
                  if (!parentNodeId) return;
                  run(
                    () =>
                      linkNodes({
                        parentNodeId,
                        childNodeId: node.id,
                        revalidate: treePath,
                      }),
                    () => setAddingParent(false)
                  );
                }}
              >
                <div className="text-xs font-medium">
                  Link “{node.title}” under another parent
                </div>
                <select name="parentNodeId" className={inputCls} defaultValue="">
                  <option value="">— pick a parent —</option>
                  {allNodes
                    .filter(
                      (n) =>
                        n.id !== node.id &&
                        !node.parents.some((p) => p.id === n.id) &&
                        TIER_RANK[n.tier as Tier] <= TIER_RANK[node.tier as Tier]
                    )
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        [{TIER_LABELS[n.tier as Tier] ?? n.tier}] {n.title}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={isPending}
                  className="self-start rounded bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Add parent link
                </button>
                <p className="text-[11px] text-muted">
                  Multiple parents are a feature: a node&apos;s parent count is
                  its leverage score. Cycles and uphill links are rejected.
                </p>
              </form>
            )}

            {node.parents.length > 0 && (
              <div className="text-xs">
                <div className="mb-1 font-medium uppercase tracking-wide text-muted">
                  Parent links
                </div>
                <ul className="flex flex-col gap-1">
                  {node.parents.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenNode(p.id)}
                        className="truncate text-accent hover:underline"
                      >
                        {p.title}
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          run(() =>
                            unlinkNodes({
                              parentNodeId: p.id,
                              childNodeId: node.id,
                              revalidate: treePath,
                            })
                          )
                        }
                        className="text-muted hover:text-red-600"
                      >
                        unlink
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {node.editLog.length > 0 && (
          <div className="border-t border-line p-4 text-xs">
            <div className="mb-1 font-medium uppercase tracking-wide text-muted">
              Edit log
            </div>
            <ul className="flex flex-col gap-1 text-muted">
              {node.editLog.map((e, i) => (
                <li key={i}>
                  <span className="text-foreground">{e.user}</span>{" "}
                  {e.action.toLowerCase()} · {e.detail} · {e.when}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
