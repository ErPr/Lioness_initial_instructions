import Link from "next/link";
import { getCoalitionData } from "@/lib/coalition";
import { aiAvailable, refineBridges } from "@/lib/ai";

export const dynamic = "force-dynamic";

const VERDICT_STYLE: Record<string, string> = {
  SAME_EFFORT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  COMPLEMENTARY: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  WEAK: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};
const VERDICT_LABEL: Record<string, string> = {
  SAME_EFFORT: "same effort",
  COMPLEMENTARY: "complementary",
  WEAK: "weak overlap",
};

export default async function CoalitionsPage() {
  const data = await getCoalitionData();
  const verdicts = await refineBridges(data.bridges.slice(0, 24));

  const shownAlliances = data.alliances.slice(0, 20);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Coalition graph
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          Where different movements are working on the same thing. Computed
          from the text of all {data.nodeCount} tree nodes across every board —
          each bridge links two nodes from different movements that describe
          overlapping efforts.
        </p>
        <p className="mt-1 text-xs text-muted">
          {aiAvailable() ? (
            <>
              ✦ Claude refinement is on — top matches are classified as{" "}
              <em>same effort</em>, <em>complementary</em>, or{" "}
              <em>weak overlap</em>.
            </>
          ) : (
            <>
              Lexical matching only. Set{" "}
              <code className="rounded bg-surface px-1">ANTHROPIC_API_KEY</code>{" "}
              in <code className="rounded bg-surface px-1">.env</code> to add
              Claude classification of each match.
            </>
          )}
        </p>
      </div>

      {shownAlliances.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          No cross-movement overlaps found yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {shownAlliances.map((al) => (
            <section
              key={al.boards[0].id + al.boards[1].id}
              className="rounded-lg border border-line bg-surface"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line px-4 py-2.5">
                <Link
                  href={`/b/${al.boards[0].slug}`}
                  className="text-sm font-semibold hover:text-accent"
                >
                  {al.boards[0].name}
                </Link>
                <span className="text-muted">⇄</span>
                <Link
                  href={`/b/${al.boards[1].slug}`}
                  className="text-sm font-semibold hover:text-accent"
                >
                  {al.boards[1].name}
                </Link>
                <span className="ml-auto text-[11px] text-muted">
                  {al.bridges.length} shared{" "}
                  {al.bridges.length === 1 ? "effort" : "efforts"} · alliance
                  score {al.score.toFixed(2)}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {al.bridges.slice(0, 4).map((br) => {
                  const v = verdicts.get(`${br.a.id}|${br.b.id}`);
                  return (
                    <li
                      key={br.a.id + br.b.id}
                      className="grid gap-1 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr]"
                    >
                      <Link
                        href={`/b/${br.a.boardSlug}/tree?node=${br.a.id}`}
                        className="min-w-0 truncate text-[13px] hover:text-accent"
                        title={br.a.title}
                      >
                        {br.a.title}
                      </Link>
                      <div className="flex items-center gap-2 justify-self-center text-[11px] text-muted">
                        <span className="tabular-nums">
                          {(br.score * 100).toFixed(0)}%
                        </span>
                        {v && (
                          <span
                            className={`rounded-full px-2 py-px font-medium ${VERDICT_STYLE[v.verdict]}`}
                            title={v.rationale}
                          >
                            {VERDICT_LABEL[v.verdict]}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/b/${br.b.boardSlug}/tree?node=${br.b.id}`}
                        className="min-w-0 truncate text-[13px] hover:text-accent sm:text-right"
                        title={br.b.title}
                      >
                        {br.b.title}
                      </Link>
                      {v && (
                        <p className="text-[11px] text-muted sm:col-span-3">
                          {v.rationale}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
