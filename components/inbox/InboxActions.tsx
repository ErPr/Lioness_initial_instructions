"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InboxItemView } from "@/lib/inboxQuery";
import { confirmPlacement, rejectItem } from "@/lib/actions/capture";
import { CONTRIBUTION_TYPES } from "@/lib/types";

export interface PickerBoard {
  boardId: string;
  name: string;
  nodes: { id: string; title: string; tier: string }[];
}

// Phase 4 — the confirm loop. A routed item shows its best suggestion with a
// one-tap Confirm; the owner can switch to any other node, change the
// contribution type, or reject. Confirm creates the public Post.
export default function InboxActions({
  item,
  boards,
}: {
  item: InboxItemView;
  boards: PickerBoard[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const top = item.top;
  // Editable target — defaults to the AI's top pick.
  const [nodeId, setNodeId] = useState(top?.nodeId ?? "");
  const [type, setType] = useState(top?.contributionType ?? "RESOURCE");

  const flatNodes = boards.flatMap((b) =>
    b.nodes.map((n) => ({ ...n, boardName: b.name }))
  );
  const chosen = flatNodes.find((n) => n.id === nodeId);

  function run(fn: () => Promise<{ error?: string; ok?: boolean }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (!top && !picking) {
    // Nothing matched — offer manual placement or reject.
    return (
      <div className="border-t border-line px-3 py-2 text-xs">
        <span className="text-muted">No suggestion — </span>
        <button
          onClick={() => setPicking(true)}
          className="font-medium text-accent hover:underline"
        >
          place it yourself
        </button>
        <span className="text-muted"> or </span>
        <button
          onClick={() => run(() => rejectItem(item.id))}
          disabled={pending}
          className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
        >
          dismiss
        </button>
        {error && <div className="mt-1 text-red-600">{error}</div>}
      </div>
    );
  }

  return (
    <div className="border-t border-line px-3 py-2.5 text-xs">
      {!picking ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted">Place on</span>
          <span className="font-medium">{chosen?.boardName ?? top?.boardName}</span>
          <span className="text-muted">→</span>
          <span className="font-medium text-accent">
            {chosen?.title ?? top?.nodeTitle}
          </span>
          <span className="rounded bg-stone-100 px-1.5 py-px text-[10px] uppercase tracking-wide text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            {type}
          </span>
          {item.aiSource && (
            <span className="text-[10px] text-muted">
              · {item.aiSource === "claude" ? "AI" : "auto"}-suggested
              {top ? ` ${Math.round((top.confidence ?? 0) * 100)}%` : ""}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted">Node</span>
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="rounded border border-line bg-background px-2 py-1"
            >
              <option value="">— choose a node —</option>
              {boards.map((b) => (
                <optgroup key={b.boardId} label={b.name}>
                  {b.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.tier} · {n.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">As</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded border border-line bg-background px-2 py-1"
            >
              {CONTRIBUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Alternate AI candidates as quick chips. */}
      {!picking && item.candidates.length > 1 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.candidates.slice(1).map((c) => (
            <button
              key={c.nodeId}
              onClick={() => {
                setNodeId(c.nodeId);
                setType(c.contributionType);
              }}
              className="rounded-full border border-line px-2 py-px text-[11px] text-muted hover:border-accent hover:text-accent"
            >
              {c.nodeTitle}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => run(() => confirmPlacement(item.id, nodeId, type))}
          disabled={pending || !nodeId}
          className="rounded bg-accent px-3 py-1 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Placing…" : "Confirm"}
        </button>
        <button
          onClick={() => setPicking((p) => !p)}
          disabled={pending}
          className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
        >
          {picking ? "Cancel" : "Pick different node"}
        </button>
        <button
          onClick={() => run(() => rejectItem(item.id))}
          disabled={pending}
          className="ml-auto text-muted hover:text-red-600 hover:underline disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <div className="mt-1 text-red-600">{error}</div>}
    </div>
  );
}
