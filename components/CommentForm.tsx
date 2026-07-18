"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createComment, type FormState } from "@/lib/actions/forum";
import {
  CONTRIBUTION_LABELS,
  CONTRIBUTION_TYPES,
  TIER_LABELS,
} from "@/lib/types";
import type { NodeOption } from "@/components/PostForm";

const inputCls =
  "w-full rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export default function CommentForm({
  postId,
  parentCommentId,
  nodes,
  compact = false,
  onDone,
}: {
  postId: string;
  parentCommentId?: string;
  nodes: NodeOption[];
  compact?: boolean;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createComment,
    {}
  );
  const [showExtras, setShowExtras] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  // After a successful submit (pending -> settled with no error), reset.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
      onDone?.();
    }
    wasPending.current = pending;
  }, [pending, state.error, onDone]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="postId" value={postId} />
      {parentCommentId && (
        <input type="hidden" name="parentCommentId" value={parentCommentId} />
      )}
      <textarea
        name="body"
        rows={compact ? 2 : 3}
        required
        placeholder={parentCommentId ? "Write a reply..." : "Add a comment..."}
        className={inputCls}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving..." : parentCommentId ? "Reply" : "Comment"}
        </button>
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          className="text-xs text-muted hover:text-foreground"
        >
          {showExtras ? "Hide type & node" : "Set type & node"}
        </button>
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
      {showExtras && (
        <div className="flex flex-col gap-2 rounded border border-line bg-background p-2 sm:flex-row">
          <select
            name="contributionType"
            defaultValue="DISCUSSION"
            className={inputCls + " sm:max-w-40"}
          >
            {CONTRIBUTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTRIBUTION_LABELS[t]}
              </option>
            ))}
          </select>
          <select name="treeNodeId" defaultValue="" className={inputCls}>
            <option value="">No node attachment</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                [{TIER_LABELS[n.tier as keyof typeof TIER_LABELS] ?? n.tier}]{" "}
                {n.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </form>
  );
}
