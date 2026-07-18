"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/lib/actions/auth";

export default function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="mx-auto mt-12 w-full max-w-sm rounded-lg border border-line bg-surface p-6">
      <h1 className="mb-4 text-lg font-semibold">
        {mode === "login" ? "Log in" : "Create an account"}
      </h1>
      <form action={formAction} className="flex flex-col gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Username</span>
          <input
            name="username"
            required
            autoComplete="username"
            className="w-full rounded border border-line bg-background px-2.5 py-1.5 outline-none focus:border-accent"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            className="w-full rounded border border-line bg-background px-2.5 py-1.5 outline-none focus:border-accent"
          />
        </label>
        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Working..."
            : mode === "login"
              ? "Log in"
              : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link href="/register" className="text-accent hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
