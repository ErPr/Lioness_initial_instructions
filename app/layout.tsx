import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/session";
import { logout } from "@/lib/actions/auth";
import ThemeToggle from "@/components/ThemeToggle";

// Runs before paint so a saved dark preference never flashes light.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("lioness.theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export const metadata: Metadata = {
  title: "Lioness",
  description:
    "A discussion platform where every conversation is also a goal tree.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-4 px-4">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight text-accent"
            >
              <span aria-hidden className="text-lg leading-none">
                &#129409;
              </span>
              Lioness
            </Link>
            <span className="text-sm text-muted hidden sm:inline">
              movements, mapped
            </span>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <ThemeToggle />
              {user ? (
                <>
                  <span className="text-muted">{user.username}</span>
                  <form action={logout}>
                    <button
                      type="submit"
                      className="text-muted hover:text-foreground"
                    >
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="hover:text-accent">
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="rounded bg-accent px-2.5 py-1 text-white hover:opacity-90"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
