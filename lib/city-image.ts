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

/** Main city photo from Wikipedia (summary endpoint). Shared fallback. */
export async function getCityImage(
  city: string,
  country?: string
): Promise<string | null> {
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
 * Fetch a pool of real photos for a city from Wikimedia Commons.
 * Commons has a dedicated `Category:{City}` with dozens to thousands of images,
 * all guaranteed to be about that city. We filter out non-photos (svg, tiff, etc.).
 */
export async function getCommonsCityImages(city: string): Promise<string[]> {
  // Try a few likely category titles
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
          // Keep only real photos (jpeg/png/webp)
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
