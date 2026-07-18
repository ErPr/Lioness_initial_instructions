"use client";

import { useState } from "react";
import Link from "next/link";
import TypeBadge from "@/components/TypeBadge";
import VoteWidget from "@/components/VoteWidget";
import CommentForm from "@/components/CommentForm";
import { deleteComment } from "@/lib/actions/forum";
import type { NodeOption } from "@/components/PostForm";

export interface CommentView {
  id: string;
  author: string;
  body: string;
  contributionType: string;
  when: string; // precomputed "3h ago"
  deleted: boolean;
  isMine: boolean;
  treeNode: { id: string; title: string } | null;
  score: number;
  myVote: number;
  children: CommentView[];
}

export default function CommentThread({
  comments,
  postId,
  boardSlug,
  nodes,
  loggedIn,
}: {
  comments: CommentView[];
  postId: string;
  boardSlug: string;
  nodes: NodeOption[];
  loggedIn: boolean;
}) {
  if (comments.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        No comments yet. Start the discussion.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          postId={postId}
          boardSlug={boardSlug}
          nodes={nodes}
          loggedIn={loggedIn}
        />
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  boardSlug,
  nodes,
  loggedIn,
}: {
  comment: CommentView;
  postId: string;
  boardSlug: string;
  nodes: NodeOption[];
  loggedIn: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const path = `/b/${boardSlug}/post/${postId}`;

  return (
    <div className="flex gap-2">
      {!comment.deleted && (
        <VoteWidget
          targetType="COMMENT"
          targetId={comment.id}
          score={comment.score}
          myVote={comment.myVote}
          loggedIn={loggedIn}
          revalidate={path}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {comment.deleted ? (
            <span className="italic">deleted</span>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {comment.author}
              </span>
              <span>{comment.when}</span>
              {comment.contributionType !== "DISCUSSION" && (
                <TypeBadge type={comment.contributionType} />
              )}
              {comment.treeNode && (
                <Link
                  href={`/b/${boardSlug}/tree?node=${comment.treeNode.id}`}
                  className="rounded bg-accent-soft px-1.5 py-px text-accent hover:underline"
                >
                  ⤷ {comment.treeNode.title}
                </Link>
              )}
            </>
          )}
        </div>
        {!comment.deleted && (
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.body}</p>
        )}
        {!comment.deleted && (
          <div className="mt-1 flex gap-3 text-xs text-muted">
            {loggedIn && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="hover:text-foreground"
              >
                {replying ? "Cancel" : "Reply"}
              </button>
            )}
            {comment.isMine && (
              <button
                type="button"
                onClick={() => deleteComment(comment.id)}
                className="hover:text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        )}
        {replying && (
          <div className="mt-2">
            <CommentForm
              postId={postId}
              parentCommentId={comment.id}
              nodes={nodes}
              compact
              onDone={() => setReplying(false)}
            />
          </div>
        )}
        {comment.children.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 border-l-2 border-line pl-3">
            {comment.children.map((child) => (
              <CommentItem
                key={child.id}
                comment={child}
                postId={postId}
                boardSlug={boardSlug}
                nodes={nodes}
                loggedIn={loggedIn}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
