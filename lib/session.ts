import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface SessionData {
  userId?: string;
  username?: string;
}

// Pilot default so `npm run dev` works with zero setup; override in prod.
const SESSION_PASSWORD =
  process.env.SESSION_PASSWORD ??
  "lioness-pilot-dev-secret-change-me-in-production-1234";

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), {
    password: SESSION_PASSWORD,
    cookieName: "lioness_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

/** The logged-in user, verified against the DB, or null. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, createdAt: true },
  });
  return user;
}

/** Like getCurrentUser but throws if not logged in (for mutations). */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be logged in to do that.");
  return user;
}
