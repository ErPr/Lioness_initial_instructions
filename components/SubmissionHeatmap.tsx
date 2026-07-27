"use client";

import { useState } from "react";
import type { HeatmapData } from "@/lib/heatmap";

// Sequential amber ramp (light → dark) — magnitude encoding. Validated for
// lightness monotonicity; counts render as text on cells for contrast relief.
const RAMP = ["#fde8c8", "#f7c877", "#e8912d", "#b45309", "#7c3a06"];

function cellStyle(count: number, max: number): {
  bg: string;
  fg: string;
} {
  if (count === 0) return { bg: "var(--surface)", fg: "var(--muted)" };
  // 5 buckets by share of the busiest cell.
  const t = count / max;
  const idx = Math.min(RAMP.length - 1, Math.floor(t * RAMP.length));
  // Text stays legible: dark ink on the two lightest steps, white above.
  const fg = idx <= 1 ? "#7c2d12" : "#ffffff";
  return { bg: RAMP[idx], fg };
}

export default function SubmissionHeatmap({ data }: { data: HeatmapData }) {
  const [hover, setHover] = useState<{
    cat: string;
    week: string;
    count: number;
    boards: number;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th className="w-44" />
              {data.weeks.map((w, i) => (
                <th
                  key={i}
                  className="pb-1 text-center text-[10px] font-medium text-muted"
                  title={`${w.startDaysAgo}–${w.startDaysAgo - 7} days ago`}
                >
                  {i === data.weeks.length - 1 ? "now" : `${w.startDaysAgo - 7}d`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.category}>
                <td className="pr-2 text-right align-middle text-[12px] leading-tight text-foreground">
                  {row.category}
                </td>
                {row.cells.map((cell, i) => {
                  const { bg, fg } = cellStyle(cell.count, data.max);
                  return (
                    <td key={i}>
                      <div
                        onMouseEnter={(e) =>
                          setHover({
                            cat: row.category,
                            week: data.weeks[i].label,
                            count: cell.count,
                            boards: cell.boards,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseMove={(e) =>
                          setHover((h) =>
                            h ? { ...h, x: e.clientX, y: e.clientY } : h
                          )
                        }
                        onMouseLeave={() => setHover(null)}
                        className="flex h-8 w-11 items-center justify-center rounded-[4px] text-[11px] font-medium tabular-nums transition-transform hover:scale-110"
                        style={{
                          background: bg,
                          color: fg,
                          border:
                            cell.count === 0
                              ? "1px solid var(--line)"
                              : "none",
                        }}
                      >
                        {cell.count || ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 pl-44 text-[11px] text-muted">
        <span>fewer</span>
        {RAMP.map((c) => (
          <span
            key={c}
            className="inline-block h-3 w-6 rounded-[3px]"
            style={{ background: c }}
          />
        ))}
        <span>more submissions / week</span>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-medium">{hover.cat}</div>
          <div className="text-muted">
            {hover.count} submission{hover.count === 1 ? "" : "s"} ·{" "}
            {hover.boards} movement{hover.boards === 1 ? "" : "s"} · {hover.week}
          </div>
        </div>
      )}
    </div>
  );
}
