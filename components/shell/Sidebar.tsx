"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarBoard {
  slug: string;
  name: string;
}
export interface SidebarCategory {
  name: string;
  count: number;
}

/**
 * The app shell's persistent left sidebar: the user's movements on top,
 * category browsing below. Collapses to a thin rail; choice is remembered.
 */
export default function Sidebar({
  myBoards,
  categories,
  loggedIn,
}: {
  myBoards: SidebarBoard[];
  categories: SidebarCategory[];
  loggedIn: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const saved = window.localStorage.getItem("lioness.sidebar");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage sync
    setCollapsed(saved !== null ? saved === "closed" : window.innerWidth < 1100);
  }, []);
  function toggle() {
    setCollapsed((c) => {
      window.localStorage.setItem("lioness.sidebar", c ? "open" : "closed");
      return !c;
    });
  }

  if (collapsed) {
    return (
      <div className="hidden w-9 shrink-0 flex-col items-center border-r border-line bg-surface pt-3 md:flex">
        <button
          type="button"
          onClick={toggle}
          aria-label="Expand sidebar"
          className="text-muted hover:text-accent"
        >
          »
        </button>
        <span
          className="mt-4 text-[10px] uppercase tracking-widest text-muted"
          style={{ writingMode: "vertical-rl" }}
        >
          Movements
        </span>
      </div>
    );
  }

  return (
    <div className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface md:flex">
      <div className="sticky top-0 flex items-center gap-2 border-b border-line bg-surface px-3 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        Movements
        <button
          type="button"
          onClick={toggle}
          aria-label="Collapse sidebar"
          className="ml-auto text-sm normal-case tracking-normal hover:text-accent"
        >
          «
        </button>
      </div>

      <div className="flex flex-col gap-0.5 p-2">
        <Link
          href="/explore"
          className={`rounded px-2 py-1.5 text-sm hover:bg-background ${
            pathname === "/explore" ? "font-semibold text-accent" : ""
          }`}
        >
          ⌕ Explore all movements
        </Link>
        <Link
          href="/coalitions"
          className={`rounded px-2 py-1.5 text-sm hover:bg-background ${
            pathname === "/coalitions" ? "font-semibold text-accent" : ""
          }`}
        >
          ⚭ Coalition graph
        </Link>
      </div>

      <div className="px-3 pt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted">
        My movements
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        {myBoards.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted">
            {loggedIn
              ? "Join a movement and it appears here."
              : "Log in to join movements."}
          </p>
        ) : (
          myBoards.map((b) => (
            <Link
              key={b.slug}
              href={`/b/${b.slug}`}
              className={`truncate rounded px-2 py-1 text-[13px] hover:bg-background hover:text-accent ${
                pathname.startsWith(`/b/${b.slug}`)
                  ? "bg-accent-soft font-medium text-accent"
                  : ""
              }`}
              title={b.name}
            >
              {b.name}
            </Link>
          ))
        )}
      </div>

      <div className="px-3 pt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted">
        Browse
      </div>
      <div className="flex flex-col gap-0.5 p-2 pb-6">
        {categories.map((c) => (
          <Link
            key={c.name}
            href={`/explore?cat=${encodeURIComponent(c.name)}`}
            className="flex items-baseline gap-2 rounded px-2 py-1 text-[13px] text-foreground hover:bg-background hover:text-accent"
          >
            <span className="truncate">{c.name}</span>
            <span className="ml-auto text-[11px] text-muted">{c.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
