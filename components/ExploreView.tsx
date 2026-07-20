"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface ExploreBoard {
  slug: string;
  name: string;
  description: string;
  category: string;
  momentum: number;
  importance: number;
  posts: number;
  nodes: number;
  members: number;
}

const CAT_COLORS = [
  "#f59e0b",
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#f43f5e",
  "#0ea5e9",
  "#84cc16",
  "#e879f9",
  "#f97316",
  "#14b8a6",
];

type View = "list" | "leaderboard" | "map";

export default function ExploreView({
  boards,
  initialCategory,
}: {
  boards: ExploreBoard[];
  initialCategory?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(initialCategory ?? "");
  const [view, setView] = useState<View>("list");

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of boards) if (b.category) m.set(b.category, (m.get(b.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [boards]);
  const catColor = useMemo(
    () =>
      Object.fromEntries(
        categories.map(([name], i) => [name, CAT_COLORS[i % CAT_COLORS.length]])
      ),
    [categories]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return boards
      .filter((b) => !cat || b.category === cat)
      .filter(
        (b) =>
          !query ||
          b.name.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query)
      )
      .sort((a, b) => b.momentum - a.momentum || a.name.localeCompare(b.name));
  }, [boards, q, cat]);

  const scored = filtered.filter((b) => b.momentum > 0);
  const [mMin, mMax] = [
    Math.min(...scored.map((b) => b.momentum), 60),
    Math.max(...scored.map((b) => b.momentum), 95),
  ];
  const [iMin, iMax] = [
    Math.min(...scored.map((b) => b.importance), 60),
    Math.max(...scored.map((b) => b.importance), 95),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${boards.length} movements...`}
          className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="flex rounded-lg border border-line bg-surface text-sm">
          {(
            [
              ["list", "List"],
              ["leaderboard", "Leaderboard"],
              ["map", "Map"],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 first:rounded-l-lg last:rounded-r-lg ${
                view === v ? "bg-accent font-medium text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {filtered.length} shown · sorted by momentum
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCat("")}
          className={`rounded-full px-3 py-1 text-xs ${
            !cat ? "bg-accent text-white" : "border border-line bg-surface text-muted hover:text-foreground"
          }`}
        >
          All
        </button>
        {categories.map(([name, n]) => (
          <button
            key={name}
            type="button"
            onClick={() => setCat(cat === name ? "" : name)}
            className={`rounded-full px-3 py-1 text-xs ${
              cat === name
                ? "bg-accent text-white"
                : "border border-line bg-surface text-muted hover:text-foreground"
            }`}
          >
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{ background: catColor[name] }}
            />
            {name} {n}
          </button>
        ))}
      </div>

      {view === "list" && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <li
              key={b.slug}
              className="rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-accent"
            >
              <div className="flex items-start gap-2">
                <Link
                  href={`/b/${b.slug}`}
                  className="min-w-0 text-sm font-medium hover:text-accent"
                >
                  {b.name}
                </Link>
                {b.momentum > 0 && (
                  <span className="ml-auto shrink-0 rounded bg-accent-soft px-1.5 text-[11px] font-semibold text-accent">
                    {b.momentum}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{b.description}</p>
              <div className="mt-2 flex gap-3 text-[11px] text-muted">
                <span
                  className="inline-block h-2 w-2 translate-y-0.5 rounded-full"
                  style={{ background: catColor[b.category] ?? "#a8a29e" }}
                  title={b.category}
                />
                <span>{b.posts} posts</span>
                <span>{b.members} members</span>
                <Link href={`/b/${b.slug}/tree`} className="text-accent hover:underline">
                  tree →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {view === "leaderboard" && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Movement</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Momentum</th>
                <th className="px-3 py-2">Importance</th>
                <th className="px-3 py-2">Posts</th>
                <th className="px-3 py-2">Members</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, i) => (
                <tr key={b.slug} className="border-b border-line/60">
                  <td className="px-3 py-2 text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/b/${b.slug}`} className="font-medium hover:text-accent">
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{b.category}</td>
                  <td className="px-3 py-2" style={{ width: 140 }}>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${b.momentum}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted tabular-nums">{b.importance || "—"}</td>
                  <td className="px-3 py-2 text-muted tabular-nums">{b.posts}</td>
                  <td className="px-3 py-2 text-muted tabular-nums">{b.members}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "map" && (
        <div className="rounded-lg border border-line bg-surface p-4">
          {scored.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No scored movements to map.
            </p>
          ) : (
            <>
              <svg viewBox="0 0 1000 520" className="block w-full">
                <line x1="60" y1="10" x2="60" y2="480" style={{ stroke: "var(--edge)" }} />
                <line x1="60" y1="480" x2="990" y2="480" style={{ stroke: "var(--edge)" }} />
                <text x="525" y="508" textAnchor="middle" fontSize="12" fill="var(--muted)">
                  momentum →
                </text>
                <text
                  x="20"
                  y="245"
                  fontSize="12"
                  fill="var(--muted)"
                  transform="rotate(-90 20 245)"
                  textAnchor="middle"
                >
                  importance →
                </text>
                {scored.map((b, idx) => {
                  const x = 70 + ((b.momentum - mMin) / Math.max(1, mMax - mMin)) * 900;
                  const y = 470 - ((b.importance - iMin) / Math.max(1, iMax - iMin)) * 450;
                  const top = idx < 5;
                  return (
                    <g
                      key={b.slug}
                      onClick={() => router.push(`/b/${b.slug}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={top ? 8 : 5.5}
                        fill={catColor[b.category] ?? "#a8a29e"}
                        fillOpacity={0.85}
                      >
                        <title>
                          {b.name} — momentum {b.momentum}, importance {b.importance}
                        </title>
                      </circle>
                      {top && (
                        <text
                          x={x - 12}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="12"
                          fill="var(--foreground)"
                        >
                          {b.name.length > 34 ? b.name.slice(0, 33) + "…" : b.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
              <p className="mt-2 text-center text-[11px] text-muted">
                Every dot is a movement — click to enter. Color = category, size
                = top 5 by momentum.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
