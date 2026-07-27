"use client";

import { useEffect } from "react";

/** Registers the no-op service worker so the app is installable. */
export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is best-effort; ignore registration failures */
    });
  }, []);
  return null;
}
