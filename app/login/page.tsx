import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { login } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(next?.startsWith("/") ? next : "/");
  return <AuthForm mode="login" action={login} next={next} />;
}
