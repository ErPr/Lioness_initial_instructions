import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { register } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="register" action={register} />;
}
