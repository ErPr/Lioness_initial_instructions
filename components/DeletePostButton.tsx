"use client";

import { deletePost } from "@/lib/actions/forum";

export default function DeletePostButton({ postId }: { postId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("Delete this post?")) deletePost(postId);
      }}
      className="text-muted hover:text-red-600"
    >
      Delete
    </button>
  );
}
