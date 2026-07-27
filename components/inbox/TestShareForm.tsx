"use client";

import { useState } from "react";

/**
 * Desktop stand-in for the phone share sheet: POSTs to /api/capture so the
 * pipeline can be demoed without an Android device. Uses a normal form POST
 * (multipart) exactly like the share target.
 */
export default function TestShareForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded border border-dashed border-line px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
      >
        + Share something to test (desktop)
      </button>
    );
  }

  return (
    <form
      action="/api/capture"
      method="POST"
      encType="multipart/form-data"
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
    >
      <div className="text-xs font-medium">Simulate a phone share</div>
      <input
        name="url"
        placeholder="Paste a link (or leave blank and use Text)"
        className="rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <input
        name="title"
        placeholder="Title (optional)"
        className="rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <textarea
        name="text"
        rows={2}
        placeholder="Shared text — a URL in here is auto-extracted, like Android does"
        className="rounded border border-line bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
      />
      <label className="text-xs text-muted">
        Screenshot (optional)
        <input
          name="files"
          type="file"
          accept="image/*"
          className="mt-1 block text-xs"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Share to inbox
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 text-sm text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
