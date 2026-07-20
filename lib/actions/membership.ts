"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function joinBoard(boardId: string, revalidate?: string) {
  const user = await requireUser();
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found.");
  await prisma.membership.upsert({
    where: { userId_boardId: { userId: user.id, boardId } },
    update: {},
    create: { userId: user.id, boardId },
  });
  revalidatePath(revalidate ?? `/b/${board.slug}`, "layout");
}

export async function leaveBoard(boardId: string, revalidate?: string) {
  const user = await requireUser();
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new Error("Board not found.");
  await prisma.membership.deleteMany({ where: { userId: user.id, boardId } });
  revalidatePath(revalidate ?? `/b/${board.slug}`, "layout");
}
