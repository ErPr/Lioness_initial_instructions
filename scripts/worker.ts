// Standalone capture worker — an alternative to the in-process instrumentation
// runner. Run in a second terminal with `npm run worker` (set LIONESS_WORKER=off
// on the server if you want only this one processing).
import { tick } from "@/lib/worker";

const INTERVAL = 4000;

async function loop() {
  try {
    await tick();
  } catch (e) {
    console.error("[worker] tick error:", e);
  }
  setTimeout(loop, INTERVAL);
}

console.log("[worker] standalone worker started");
loop();
