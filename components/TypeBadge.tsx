import {
  CONTRIBUTION_LABELS,
  type ContributionType,
} from "@/lib/types";

const COLORS: Record<ContributionType, string> = {
  DISCUSSION:
    "bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700",
  PROBLEM:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
  SOLUTION:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  STRATEGY:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
  TACTIC:
    "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900",
  RESOURCE:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  QUESTION:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-900",
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
