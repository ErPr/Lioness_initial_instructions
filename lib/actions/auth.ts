"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;

export type AuthState = { error?: string };

export async function register(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_RE.test(username)) {
    return {
      error:
        "Username must be 3-24 characters: letters, numbers, _ or - only.",
    };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: "That username is taken." };

  const user = await prisma.user.create({
    data: { username, passwordHash: await bcrypt.hash(password, 10) },
  });

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();
  redirect("/");
}

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid username or password." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();
  redirect("/");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
