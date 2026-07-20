"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The initial class is set by an inline script in the
 * root layout before paint (no flash); this button just flips and persists.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage sync
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("lioness.theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
      className="rounded border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent"
    >
      {dark === null ? "◐" : dark ? "☀" : "☾"}
    </button>
  );
}
