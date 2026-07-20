"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinBoard, leaveBoard } from "@/lib/actions/membership";

export default function JoinButton({
  boardId,
  joined,
  loggedIn,
}: {
  boardId: string;
  joined: boolean;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    startTransition(async () => {
      if (joined) await leaveBoard(boardId);
      else await joinBoard(boardId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        joined
          ? "border border-line bg-surface text-muted hover:border-red-400 hover:text-red-600"
          : "bg-accent text-white hover:opacity-90"
      }`}
      title={joined ? "Leave this movement" : "Join this movement"}
    >
      {pending ? "..." : joined ? "✓ Joined" : "+ Join"}
    </button>
  );
}
