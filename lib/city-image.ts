interface WikiSummary {
  type?: string;
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
}

interface WikiSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        index?: number;
        title?: string;
        original?: { source?: string };
        thumbnail?: { source?: string };
      }
    >;
  };
}

/** Main city photo from Wikipedia (summary endpoint). */
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
      /* next candidate */
    }
  }
  return null;
}

/**
 * Search Wikipedia for any article matching the query and return up to `limit`
 * candidate image URLs in search-rank order. Lets callers pick a non-duplicate.
 */
export async function getImageCandidates(
  query: string,
  limit = 5
): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "pageimages",
    piprop: "original|thumbnail",
    pithumbsize: "1600",
    generator: "search",
    gsrsearch: query,
    gsrlimit: String(limit),
    gsrnamespace: "0",
  });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WeekendEscapeAI/1.0" },
      next: { revalidate: 604800 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as WikiSearchResponse;
    const pages = Object.values(data.query?.pages ?? {});
    // Preserve search rank
    pages.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
    return pages
      .map((p) => p.original?.source ?? p.thumbnail?.source)
      .filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}
