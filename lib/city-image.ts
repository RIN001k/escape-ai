interface UnsplashPhoto {
  urls?: { regular?: string; full?: string };
}

interface WikiSummary {
  type?: string;
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
}

interface CommonsImageInfo {
  url?: string;
  thumburl?: string;
  mime?: string;
}

interface CommonsPage {
  title?: string;
  imageinfo?: CommonsImageInfo[];
}

interface CommonsResponse {
  query?: { pages?: Record<string, CommonsPage> };
}

/** Fetch beautiful city photos from Unsplash (primary source). */
async function getUnsplashImages(city: string, count: number): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query: `${city} city travel`,
    per_page: String(Math.min(count + 5, 20)),
    orientation: "landscape",
    content_filter: "high",
  });

  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${key}` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: UnsplashPhoto[] };
    return (data.results ?? [])
      .map((p) => p.urls?.regular ?? p.urls?.full ?? null)
      .filter((u): u is string => Boolean(u));
  } catch {
    return [];
  }
}

/** Main city photo from Wikipedia (fallback). */
export async function getCityImage(
  city: string,
  country?: string
): Promise<string | null> {
  // Try Unsplash first
  const unsplash = await getUnsplashImages(city, 1);
  if (unsplash.length > 0) return unsplash[0];

  // Fallback to Wikipedia
  const candidates = [
    city,
    country ? `${city}, ${country}` : null,
    `${city} (city)`,
  ].filter((x): x is string => Boolean(x));

  for (const title of candidates) {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.replace(/\s+/g, "_")
    )}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "WeekendEscapeAI/1.0" },
        next: { revalidate: 604800 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as WikiSummary;
      if (data.type === "disambiguation") continue;
      const src = data.originalimage?.source ?? data.thumbnail?.source;
      if (src) return src;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Fetch a pool of beautiful city photos.
 * Uses Unsplash when key is available, falls back to Wikimedia Commons.
 */
export async function getCommonsCityImages(city: string): Promise<string[]> {
  // Try Unsplash first
  const unsplash = await getUnsplashImages(city, 15);
  if (unsplash.length > 0) return unsplash;

  // Fallback: Wikimedia Commons
  const categoryCandidates = [city, `${city} (city)`];

  for (const cat of categoryCandidates) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "categorymembers",
      gcmtitle: `Category:${cat}`,
      gcmtype: "file",
      gcmlimit: "50",
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: "1600",
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "WeekendEscapeAI/1.0" },
        next: { revalidate: 604800 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as CommonsResponse;
      const pages = Object.values(data.query?.pages ?? {});
      const urls = pages
        .map((p) => {
          const info = p.imageinfo?.[0];
          if (!info) return null;
          const mime = info.mime ?? "";
          if (!/^image\/(jpeg|png|webp)$/i.test(mime)) return null;
          return info.thumburl ?? info.url ?? null;
        })
        .filter((x): x is string => Boolean(x));
      if (urls.length > 0) return urls;
    } catch {
      /* try next category */
    }
  }

  return [];
}

/** Pick N different images from a pool, shuffled. */
export function pickDistinct(pool: string[], n: number): string[] {
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
