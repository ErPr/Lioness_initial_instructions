import path from "node:path";
import { mkdir } from "node:fs/promises";

// Captured screenshots are private until the item is confirmed, so they live
// outside /public and are served only through an ownership-checked route.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads", "captures");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/** Android quirk: many apps put the shared URL in `text`, not `url`. */
export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[.,;)]+$/, "") : null;
}

/**
 * Canonicalize a URL for dedupe: lowercase host, drop the fragment, strip
 * tracking params, remove a trailing slash. Returns the input on parse failure.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.host = u.host.toLowerCase();
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "igshid",
      "si",
      "ref",
      "ref_src",
      "s",
      "t",
    ];
    for (const k of drop) u.searchParams.delete(k);
    let s = u.toString();
    s = s.replace(/\/$/, "");
    return s;
  } catch {
    return raw.trim() || null;
  }
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function extForType(type: string): string {
  return EXT[type] ?? "bin";
}
