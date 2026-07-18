"use client";

import { useActionState, useMemo, useState } from "react";
import { createPost, type FormState } from "@/lib/actions/forum";
import {
  CONTRIBUTION_LABELS,
  CONTRIBUTION_TYPES,
  TIER_LABELS,
  TIERS,
} from "@/lib/types";

export interface NodeOption {
  id: string;
  title: string;
  tier: string;
}

const inputCls =
  "w-full rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export default function PostForm({
  boardSlug,
  nodes,
}: {
  boardSlug: string;
  nodes: NodeOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createPost,
    {}
  );
  const [attachMode, setAttachMode] = useState<"none" | "existing" | "propose">(
    "none"
  );
  const [nodeSearch, setNodeSearch] = useState("");

  const filteredNodes = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => n.title.toLowerCase().includes(q));
  }, [nodes, nodeSearch]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-sm font-semibold">New post</h2>
      <input type="hidden" name="boardSlug" value={boardSlug} />
      <input
        name="title"
        placeholder="Title"
        required
        className={inputCls}
      />
      <textarea
        name="body"
        placeholder="Text, links, context... (links in Resource posts show up in the tree's Top Links tab)"
        rows={4}
        className={inputCls}
      />
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">
            Contribution type
          </span>
          <select name="contributionType" className={inputCls} defaultValue="DISCUSSION">
            {CONTRIBUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTRIBUTION_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs text-muted">Tree placement</legend>
          <div className="flex gap-3">
            {(
              [
                ["none", "None"],
                ["existing", "Attach to node"],
                ["propose", "Propose new node"],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="attachMode"
                  value={mode}
                  checked={attachMode === mode}
                  onChange={() => setAttachMode(mode)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {attachMode === "existing" && (
        <div className="flex flex-col gap-2 rounded border border-line bg-background p-3 sm:flex-row">
          <input
            value={nodeSearch}
            onChange={(e) => setNodeSearch(e.target.value)}
            placeholder="Search nodes..."
            className={inputCls + " sm:max-w-52"}
          />
          <select name="treeNodeId" className={inputCls} defaultValue="">
            <option value="">— pick a node —</option>
            {filteredNodes.map((n) => (
              <option key={n.id} value={n.id}>
                [{TIER_LABELS[n.tier as keyof typeof TIER_LABELS] ?? n.tier}]{" "}
                {n.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {attachMode === "propose" && (
        <div className="flex flex-col gap-2 rounded border border-line bg-background p-3 sm:flex-row">
          <select name="proposedTier" className={inputCls + " sm:max-w-44"} defaultValue="GOAL">
            {TIERS.filter((t) => t !== "PURPOSE").map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            name="proposedTitle"
            placeholder="Proposed node title"
            className={inputCls}
          />
        </div>
      )}

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
