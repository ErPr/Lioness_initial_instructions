// Next.js runs register() once on server startup. We use it to start the
// capture worker in-process, so shared items enrich and route automatically
// without a second terminal. Guarded to the Node runtime; disable with
// LIONESS_WORKER=off (e.g. when running the standalone `npm run worker`).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.LIONESS_WORKER === "off") return;
  const { startWorker } = await import("@/lib/worker");
  startWorker();
}
