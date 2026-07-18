import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { login } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="login" action={login} />;
}
