"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Forum | Tree | About — the two-views principle made structural. */
export default function BoardTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/b/${slug}`, label: "Forum", active: !pathname.includes("/tree") && !pathname.includes("/about") },
    { href: `/b/${slug}/tree`, label: "Tree", active: pathname.includes("/tree") },
    { href: `/b/${slug}/about`, label: "About", active: pathname.includes("/about") },
  ];
  return (
    <nav className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            t.active
              ? "border-accent text-accent"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
