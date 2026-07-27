"use client";

import type { InboxItemView } from "@/lib/inboxQuery";

// Phase 1 stub — shows the routed suggestion read-only. Phase 4 replaces this
// with Confirm / Pick different node / Reject.
export default function InboxActions({ item }: { item: InboxItemView }) {
  if (!item.top) return null;
  return (
    <div className="border-t border-line px-3 py-2 text-xs text-muted">
      Suggested: {item.top.boardName} → {item.top.nodeTitle} ·{" "}
      {item.top.contributionType} ·{" "}
      {Math.round((item.top.confidence ?? 0) * 100)}%
    </div>
  );
}
