import Link from "next/link";
import { getHeatmapData } from "@/lib/heatmap";
import SubmissionHeatmap from "@/components/SubmissionHeatmap";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const data = await getHeatmapData();

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Submission activity
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          Where the community is contributing right now. The heatmap directs
          human attention to the hot spots — so members can go pull in and
          verify what&apos;s happening on those movements, instead of relying on
          automated collection that platforms block.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Submissions by category, last 8 weeks
        </h2>
        <SubmissionHeatmap data={data} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Needs a look — hot spots</h2>
          <span className="text-[11px] text-muted">
            last 7 days · {data.totalSubmissions} submissions in window
          </span>
        </div>
        <p className="mb-3 max-w-2xl text-xs text-muted">
          Movements with the most recent activity. A surge (▲) means submissions
          are accelerating versus the previous week; unattached posts are ones
          no one has placed on the tree yet — the clearest signal that a human
          should curate.
        </p>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2">Movement</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Recent</th>
                <th className="px-3 py-2 text-right">Trend</th>
                <th className="px-3 py-2 text-right">Unattached</th>
              </tr>
            </thead>
            <tbody>
              {data.hotSpots.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    No submissions in the last week.
                  </td>
                </tr>
              ) : (
                data.hotSpots.map((h) => (
                  <tr key={h.slug} className="border-b border-line/60">
                    <td className="px-3 py-2">
                      <Link
                        href={`/b/${h.slug}`}
                        className="font-medium hover:text-accent"
                      >
                        {h.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {h.category}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {h.recent}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {h.surge >= 1.5 ? (
                        <span className="text-accent" title={`${h.surge.toFixed(1)}× prior week`}>
                          ▲ {h.surge.toFixed(1)}×
                        </span>
                      ) : h.surge <= 0.67 && h.prior > 0 ? (
                        <span className="text-muted">▼ cooling</span>
                      ) : (
                        <span className="text-muted">steady</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {h.unattached > 0 ? (
                        <Link
                          href={`/b/${h.slug}`}
                          className="text-accent hover:underline"
                          title="Posts not yet placed on the tree"
                        >
                          {h.unattached} to place
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
