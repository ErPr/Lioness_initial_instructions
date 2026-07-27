// Metadata enrichment for a shared URL. Fallback chain: provider oEmbed →
// OpenGraph/meta tags → whatever the share sheet provided. No HTML-parser
// dependency; meta tags are scanned with a tolerant regex. Never throws — the
// worker advances an item to `enriched` regardless of what it gets back.

export interface EnrichResult {
  metaTitle?: string;
  metaDescription?: string;
  metaImage?: string;
}

const UA =
  "Mozilla/5.0 (compatible; LionessBot/1.0; +https://lioness.local) Chrome/120 Safari/537";
const TIMEOUT_MS = 6000;

async function fetchText(url: string, accept: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": UA, accept },
    });
    if (!res.ok) return null;
    // Cap body size so a huge page can't hang parsing.
    const text = await res.text();
    return text.slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractMeta(html: string): EnrichResult {
  const meta = new Map<string, string>();
  const tagRe = /<meta\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[0];
    const key =
      tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (key && content && !meta.has(key)) meta.set(key, decode(content));
  }
  const titleTag = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = meta.get(k);
      if (v) return v;
    }
    return undefined;
  };
  return {
    metaTitle:
      pick("og:title", "twitter:title") ??
      (titleTag ? decode(titleTag) : undefined),
    metaDescription: pick("og:description", "twitter:description", "description"),
    metaImage: pick("og:image", "og:image:url", "twitter:image"),
  };
}

// oEmbed endpoints for providers that often block plain scraping.
const OEMBED: { test: RegExp; endpoint: (u: string) => string }[] = [
  {
    test: /(?:youtube\.com|youtu\.be)/i,
    endpoint: (u) =>
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  },
  {
    test: /tiktok\.com/i,
    endpoint: (u) =>
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  },
  {
    test: /vimeo\.com/i,
    endpoint: (u) =>
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  },
];

async function tryOEmbed(url: string): Promise<EnrichResult | null> {
  const provider = OEMBED.find((p) => p.test.test(url));
  if (!provider) return null;
  const json = await fetchText(provider.endpoint(url), "application/json");
  if (!json) return null;
  try {
    const data = JSON.parse(json) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title && !data.thumbnail_url) return null;
    return {
      metaTitle: data.title,
      metaDescription: data.author_name ? `by ${data.author_name}` : undefined,
      metaImage: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

/** Enrich a single URL. Tries oEmbed first for known providers, then OG tags. */
export async function enrichUrl(url: string): Promise<EnrichResult> {
  const viaOEmbed = await tryOEmbed(url);
  if (viaOEmbed && viaOEmbed.metaTitle) return viaOEmbed;

  const html = await fetchText(url, "text/html,application/xhtml+xml");
  const viaMeta = html ? extractMeta(html) : {};

  // Merge, preferring oEmbed where present.
  return {
    metaTitle: viaOEmbed?.metaTitle ?? viaMeta.metaTitle,
    metaDescription: viaOEmbed?.metaDescription ?? viaMeta.metaDescription,
    metaImage: viaOEmbed?.metaImage ?? viaMeta.metaImage,
  };
}
