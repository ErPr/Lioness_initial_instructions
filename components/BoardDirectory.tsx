"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface BoardCard {
  slug: string;
  name: string;
  description: string;
  category: string;
  posts: number;
  nodes: number;
}

/** Searchable, category-grouped board directory for the home page. */
export default function BoardDirectory({ boards }: { boards: BoardCard[] }) {
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = query
      ? boards.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            b.description.toLowerCase().includes(query) ||
            b.category.toLowerCase().includes(query)
        )
      : boards;
    const byCat = new Map<string, BoardCard[]>();
    for (const b of filtered) {
      const cat = b.category || "Other";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(b);
    }
    return [...byCat.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
    );
  }, [boards, q]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${boards.length} movements...`}
          className="w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {q && (
          <span className="text-xs text-muted">
            {total} match{total === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No movements match “{q}”.
        </p>
      ) : (
        groups.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 flex items-baseline gap-2 border-b border-line pb-1.5 text-sm font-semibold">
              {cat}
              <span className="text-xs font-normal text-muted">
                {list.length}
              </span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((b) => (
                <li
                  key={b.slug}
                  className="rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-accent"
                >
                  <Link
                    href={`/b/${b.slug}`}
                    className="text-sm font-medium hover:text-accent"
                  >
                    {b.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">
                    {b.description}
                  </p>
                  <div className="mt-2 flex gap-3 text-[11px] text-muted">
                    <span>{b.posts} posts</span>
                    <Link
                      href={`/b/${b.slug}/tree`}
                      className="text-accent hover:underline"
                    >
                      tree ({b.nodes}) →
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
