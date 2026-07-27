import { prisma } from "@/lib/db";
import { enrichUrl } from "@/lib/enrich";

// Background pipeline: enrich pending items, then AI-route enriched ones.
// Runs in-process (instrumentation.ts) and also as a standalone script
// (scripts/worker.ts). Both call tick(); a module-level lock prevents overlap.

const BATCH = 6;
const CONCURRENCY = 3;
const MAX_ENRICH_ATTEMPTS = 2; // initial + one retry

let running = false;

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      try {
        await fn(item);
      } catch (err) {
        console.error("[worker] item failed:", err);
      }
    }
  });
  await Promise.all(workers);
}

async function enrichStep() {
  const pending = await prisma.capturedItem.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  if (pending.length === 0) return;

  await pool(pending, CONCURRENCY, async (item) => {
    // No URL to enrich (pure text or screenshot) → straight to enriched.
    if (!item.url) {
      await prisma.capturedItem.update({
        where: { id: item.id },
        data: { status: "enriched" },
      });
      return;
    }

    const meta = await enrichUrl(item.url);
    const gotSomething = !!(meta.metaTitle || meta.metaDescription || meta.metaImage);

    // Never fail an item for enrichment; store what we got and advance. One
    // retry if the fetch returned nothing at all (transient network).
    if (!gotSomething && item.enrichAttempts + 1 < MAX_ENRICH_ATTEMPTS) {
      await prisma.capturedItem.update({
        where: { id: item.id },
        data: { enrichAttempts: { increment: 1 } },
      });
      return; // stays pending, retried next tick
    }

    await prisma.capturedItem.update({
      where: { id: item.id },
      data: {
        metaTitle: meta.metaTitle ?? null,
        metaDescription: meta.metaDescription ?? null,
        metaImage: meta.metaImage ?? null,
        enrichAttempts: { increment: 1 },
        status: "enriched",
      },
    });
  });
}

async function routeStep() {
  // Filled in by Phase 3 (AI routing + dedupe). Enriched items wait here.
}

export async function tick() {
  if (running) return;
  running = true;
  try {
    await enrichStep();
    await routeStep();
  } finally {
    running = false;
  }
}

// Singleton interval starter (guarded so dev HMR doesn't stack intervals).
const g = globalThis as unknown as { __lionessWorker?: boolean };
export function startWorker(intervalMs = 4000) {
  if (g.__lionessWorker) return;
  g.__lionessWorker = true;
  console.log("[worker] started, tick every", intervalMs, "ms");
  const loop = () => {
    tick()
      .catch((e) => console.error("[worker] tick error:", e))
      .finally(() => setTimeout(loop, intervalMs));
  };
  setTimeout(loop, intervalMs);
}
