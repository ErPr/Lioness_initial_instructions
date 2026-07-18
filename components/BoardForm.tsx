"use client";

import { useActionState, useState } from "react";
import { createBoard, type FormState } from "@/lib/actions/forum";

const inputCls =
  "w-full rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent";

export default function BoardForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createBoard,
    {}
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
      >
        + Start a movement
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <h2 className="text-sm font-semibold">New board</h2>
      <input name="name" required placeholder="Board name (e.g. Ranked Choice Voting)" className={inputCls} />
      <input
        name="purpose"
        placeholder="Purpose — the movement's single top-level goal (becomes the tree's root)"
        className={inputCls}
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Short description"
        className={inputCls}
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create board"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
