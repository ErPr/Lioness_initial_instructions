"use client";

import Image from "next/image";
import Link from "next/link";
import type { InboxItemView } from "@/lib/inboxQuery";
import InboxActions, { type PickerBoard } from "@/components/inbox/InboxActions";

const STATUS_LABEL: Record<string, string> = {
  pending: "finding metadata…",
  enriched: "routing…",
  routed: "ready to place",
  confirmed: "on the tree",
};

export default function InboxList({
  items,
  boards,
}: {
  items: InboxItemView[];
  boards: PickerBoard[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
        Share anything to Lioness from your phone and it lands here.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((it) => (
        <li
          key={it.id}
          className="overflow-hidden rounded-lg border border-line bg-surface"
        >
          <div className="flex gap-3 p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-background">
              {it.hasImage ? (
                <Image
                  src={`/api/uploads/${it.id}`}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  {it.url ? "🔗" : "📝"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-sm font-medium">
                {it.url ? (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-accent"
                  >
                    {it.displayTitle}
                  </a>
                ) : (
                  it.displayTitle
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                {it.domain && <span>{it.domain}</span>}
                <span>· {it.when}</span>
                {it.shareCount > 1 && (
                  <span className="rounded bg-accent-soft px-1.5 text-accent">
                    you and {it.shareCount - 1}{" "}
                    {it.shareCount - 1 === 1 ? "other" : "others"} shared this
                  </span>
                )}
                <span
                  className={`rounded-full px-1.5 py-px ${
                    it.status === "routed"
                      ? "bg-accent-soft text-accent"
                      : it.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
                  }`}
                >
                  {STATUS_LABEL[it.status] ?? it.status}
                </span>
              </div>
            </div>
          </div>

          {it.status === "confirmed" && it.top && (
            <div className="border-t border-line bg-emerald-50/40 px-3 py-2 text-xs dark:bg-emerald-950/20">
              Placed on{" "}
              <Link
                href={`/b/${it.top.boardSlug}/tree?node=${it.top.nodeId}`}
                className="font-medium text-accent hover:underline"
              >
                {it.top.nodeTitle}
              </Link>{" "}
              in {it.top.boardName}.
            </div>
          )}

          {it.status === "routed" && (
            <InboxActions item={it} boards={boards} />
          )}
        </li>
      ))}
    </ul>
  );
}
