"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vote } from "@/lib/actions/forum";
import type { VoteTargetType } from "@/lib/types";

/**
 * Up/down arrows with score. Toggle semantics match the server action:
 * clicking your current vote clears it; clicking the other flips it.
 */
export default function VoteWidget({
  targetType,
  targetId,
  score,
  myVote,
  loggedIn,
  revalidate,
  horizontal = false,
}: {
  targetType: VoteTargetType;
  targetId: string;
  score: number;
  myVote: number;
  loggedIn: boolean;
  revalidate?: string;
  horizontal?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic({ score, myVote });

  function cast(value: 1 | -1) {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    startTransition(async () => {
      setOptimistic((cur) => {
        const cleared = cur.score - cur.myVote;
        return cur.myVote === value
          ? { score: cleared, myVote: 0 }
          : { score: cleared + value, myVote: value };
      });
      await vote(targetType, targetId, value, revalidate);
      router.refresh();
    });
  }

  const arrow = (value: 1 | -1) => (
    <button
      type="button"
      aria-label={value === 1 ? "Upvote" : "Downvote"}
      disabled={isPending}
      onClick={() => cast(value)}
      className={`leading-none transition-colors ${
        optimistic.myVote === value
          ? "text-accent"
          : "text-stone-400 hover:text-stone-600"
      }`}
    >
      {value === 1 ? "▲" : "▼"}
    </button>
  );

  return (
    <div
      className={`flex select-none items-center text-xs ${
        horizontal ? "flex-row gap-1" : "flex-col gap-0.5"
      }`}
    >
      {arrow(1)}
      <span
        className={`min-w-4 text-center font-semibold tabular-nums ${
          optimistic.score > 0
            ? "text-stone-700"
            : optimistic.score < 0
              ? "text-red-600"
              : "text-stone-400"
        }`}
      >
        {optimistic.score}
      </span>
      {arrow(-1)}
    </div>
  );
}
