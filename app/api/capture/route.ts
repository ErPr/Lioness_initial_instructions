import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  ensureUploadDir,
  extractFirstUrl,
  extForType,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
} from "@/lib/capture";

export const runtime = "nodejs";

// The share-sheet target. Writes one CapturedItem (status pending) and returns
// immediately — no fetching or AI here; the background worker does that. GET is
// supported for manual/testing shares (?url=&title=&text=).
async function handle(req: NextRequest, fields: FormData | URLSearchParams) {
  const user = await getCurrentUser();
  if (!user) {
    // Not logged in: bounce to login and come back to the share.
    const back = "/inbox";
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(back)}`, req.url),
      303
    );
  }

  const title = str(fields.get("title"));
  const text = str(fields.get("text"));
  let url = str(fields.get("url"));
  if (!url) url = extractFirstUrl(text) ?? undefined;

  // Screenshot upload (multipart only).
  let imagePath: string | undefined;
  if (fields instanceof FormData) {
    const file = fields.get("files");
    if (file && file instanceof File && file.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Only image files can be shared." },
          { status: 415 }
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "Image is larger than 10 MB." },
          { status: 413 }
        );
      }
      await ensureUploadDir();
      const name = `${randomUUID()}.${extForType(file.type)}`;
      const buf = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, name), buf);
      imagePath = name;
    }
  }

  // Nothing usable shared at all.
  if (!url && !title && !text && !imagePath) {
    return NextResponse.redirect(new URL("/inbox", req.url), 303);
  }

  await prisma.capturedItem.create({
    data: {
      userId: user.id,
      url: url ?? null,
      title: title ?? null,
      rawText: text ?? null,
      imagePath: imagePath ?? null,
      status: "pending",
    },
  });

  // Tiny auto-closing "Saved" page so the share sheet feels instant.
  return NextResponse.redirect(new URL("/inbox/saved", req.url), 303);
}

function str(v: FormDataEntryValue | string | null): string | undefined {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  return handle(req, form);
}

export async function GET(req: NextRequest) {
  return handle(req, req.nextUrl.searchParams);
}
