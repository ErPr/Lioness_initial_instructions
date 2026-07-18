import {
  CONTRIBUTION_LABELS,
  type ContributionType,
} from "@/lib/types";

const COLORS: Record<ContributionType, string> = {
  DISCUSSION: "bg-stone-100 text-stone-600 border-stone-200",
  PROBLEM: "bg-red-50 text-red-700 border-red-200",
  SOLUTION: "bg-emerald-50 text-emerald-700 border-emerald-200",
  STRATEGY: "bg-indigo-50 text-indigo-700 border-indigo-200",
  TACTIC: "bg-sky-50 text-sky-700 border-sky-200",
  RESOURCE: "bg-amber-50 text-amber-700 border-amber-200",
  QUESTION: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function TypeBadge({ type }: { type: string }) {
  const t = type as ContributionType;
  const cls = COLORS[t] ?? COLORS.DISCUSSION;
  return (
    <span
      className={`inline-block rounded border px-1.5 py-px text-[11px] font-medium uppercase tracking-wide ${cls}`}
    >
      {CONTRIBUTION_LABELS[t] ?? type}
    </span>
  );
}
