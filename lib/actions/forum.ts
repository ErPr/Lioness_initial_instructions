"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/format";
import {
  isContributionType,
  isTier,
  isVoteTargetType,
  type VoteTargetType,
} from "@/lib/types";

export type FormState = { error?: string };

export async function createBoard(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 3) return { error: "Board name must be at least 3 characters." };

  const slug = slugify(name);
  if (!slug) return { error: "Board name must contain letters or numbers." };
  if (await prisma.board.findUnique({ where: { slug } })) {
    return { error: `A board with the slug "${slug}" already exists.` };
  }

  await prisma.board.create({ data: { slug, name, description } });

  // Every board owns exactly one tree: create its Purpose root immediately so
  // the one-root invariant holds from birth. The founder retitles it in the
  // tree view.
  const purposeTitle = String(formData.get("purpose") ?? "").trim() || name;
  const board = await prisma.board.findUniqueOrThrow({ where: { slug } });
  const node = await prisma.treeNode.create({
    data: {
      boardId: board.id,
      tier: "PURPOSE",
      title: purposeTitle,
      summary: description,
      createdByUserId: user.id,
    },
  });
  await prisma.nodeEditLog.create({
    data: {
      nodeId: node.id,
      userId: user.id,
      action: "CREATE",
      detail: "Purpose root created with board",
    },
  });

  redirect(`/b/${slug}`);
}

export async function createPost(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const boardSlug = String(formData.get("boardSlug") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const contributionType = String(formData.get("contributionType") ?? "DISCUSSION");
  const attachMode = String(formData.get("attachMode") ?? "none"); // none | existing | propose
  const treeNodeId = String(formData.get("treeNodeId") ?? "");
  const proposedTier = String(formData.get("proposedTier") ?? "");
  const proposedTitle = String(formData.get("proposedTitle") ?? "").trim();

  const board = await prisma.board.findUnique({ where: { slug: boardSlug } });
  if (!board) return { error: "Board not found." };
  if (title.length < 3) return { error: "Title must be at least 3 characters." };
  if (!isContributionType(contributionType)) return { error: "Invalid contribution type." };

  const data: {
    boardId: string;
    authorId: string;
    title: string;
    body: string;
    contributionType: string;
    treeNodeId?: string;
    proposesNode?: boolean;
    proposedTier?: string;
    proposedTitle?: string;
  } = { boardId: board.id, authorId: user.id, title, body, contributionType };

  if (attachMode === "existing" && treeNodeId) {
    const node = await prisma.treeNode.findUnique({ where: { id: treeNodeId } });
    if (!node || node.boardId !== board.id) {
      return { error: "That tree node doesn't belong to this board." };
    }
    data.treeNodeId = treeNodeId;
  } else if (attachMode === "propose") {
    if (!isTier(proposedTier)) return { error: "Pick a tier for the proposed node." };
    if (proposedTier === "PURPOSE") {
      return { error: "A board has exactly one Purpose node — propose a lower tier." };
    }
    if (proposedTitle.length < 3) {
      return { error: "Give the proposed node a title (3+ characters)." };
    }
    data.proposesNode = true;
    data.proposedTier = proposedTier;
    data.proposedTitle = proposedTitle;
  }

  const post = await prisma.post.create({ data });
  redirect(`/b/${boardSlug}/post/${post.id}`);
}

export async function createComment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const postId = String(formData.get("postId") ?? "");
  const parentCommentId = String(formData.get("parentCommentId") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();
  const contributionType = String(formData.get("contributionType") ?? "DISCUSSION");
  const treeNodeId = String(formData.get("treeNodeId") ?? "") || null;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { board: true },
  });
  if (!post) return { error: "Post not found." };
  if (!body) return { error: "Comment can't be empty." };
  if (!isContributionType(contributionType)) return { error: "Invalid contribution type." };

  if (parentCommentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentCommentId } });
    if (!parent || parent.postId !== postId) return { error: "Invalid parent comment." };
  }
  if (treeNodeId) {
    const node = await prisma.treeNode.findUnique({ where: { id: treeNodeId } });
    if (!node || node.boardId !== post.boardId) {
      return { error: "That tree node doesn't belong to this board." };
    }
  }

  await prisma.comment.create({
    data: {
      postId,
      authorId: user.id,
      parentCommentId,
      body,
      contributionType,
      treeNodeId,
    },
  });
  revalidatePath(`/b/${post.board.slug}/post/${postId}`);
  return {};
}

export async function deletePost(postId: string) {
  const user = await requireUser();
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { board: true },
  });
  if (!post || post.authorId !== user.id) throw new Error("Not your post.");
  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/b/${post.board.slug}`);
  redirect(`/b/${post.board.slug}`);
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { post: { include: { board: true } } },
  });
  if (!comment || comment.authorId !== user.id) throw new Error("Not your comment.");
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/b/${comment.post.board.slug}/post/${comment.postId}`);
}

/**
 * Toggle-style voting: voting the same direction again removes the vote,
 * otherwise the vote is created/flipped. Revalidates the given path.
 */
export async function vote(
  targetType: VoteTargetType,
  targetId: string,
  value: 1 | -1,
  revalidate?: string
) {
  const user = await requireUser();
  if (!isVoteTargetType(targetType) || (value !== 1 && value !== -1)) {
    throw new Error("Invalid vote.");
  }

  // Verify the target exists (polymorphic, so no FK does this for us).
  const exists =
    targetType === "POST"
      ? await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } })
      : targetType === "COMMENT"
        ? await prisma.comment.findUnique({ where: { id: targetId }, select: { id: true } })
        : await prisma.treeNode.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!exists) throw new Error("Vote target not found.");

  const existing = await prisma.vote.findUnique({
    where: {
      userId_targetType_targetId: { userId: user.id, targetType, targetId },
    },
  });

  if (existing && existing.value === value) {
    await prisma.vote.delete({ where: { id: existing.id } });
  } else {
    await prisma.vote.upsert({
      where: {
        userId_targetType_targetId: { userId: user.id, targetType, targetId },
      },
      update: { value, createdAt: new Date() },
      create: { userId: user.id, targetType, targetId, value },
    });
  }
  if (revalidate) revalidatePath(revalidate);
}
