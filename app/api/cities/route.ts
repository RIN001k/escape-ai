import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface CitySuggestion {
  id: number;
  name: string;
  country: string;
  country_code: string;
  admin1?: string;
  population?: number;
  lat: number;
  lon: number;
}

interface RawResult {
  id: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  feature_code?: string;
  population?: number;
  latitude: number;
  longitude: number;
}

const CITY_FEATURE_CODES = new Set([
  "PPL",   // populated place
  "PPLC",  // capital of a political entity
  "PPLA",  // seat of first-order admin division
  "PPLA2", // seat of second-order admin division
  "PPLA3",
  "PPLG",  // seat of government
]);

// Feature codes that should be shown regardless of population (capitals & admin centers)
const ALWAYS_ALLOW = new Set(["PPLC", "PPLA", "PPLG"]);

const MIN_POPULATION = 50_000;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ results: [] });

  // Fetch more raw results so we still have enough after filtering villages out.
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    q
  )}&count=30&language=en&format=json`;

  try {
    const res = await fetch(url, {
      // Cache identical queries for 24h at the edge — cities don't move.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ results: [] });

    const json = (await res.json()) as { results?: RawResult[] };
    const raw = json.results ?? [];

    const suggestions: CitySuggestion[] = raw
      .filter((r) => {
        // Must be a city-like feature code
        if (r.feature_code && !CITY_FEATURE_CODES.has(r.feature_code)) return false;
        // Always allow capitals / admin centers — they may lack population data
        if (r.feature_code && ALWAYS_ALLOW.has(r.feature_code)) return true;
        // Otherwise require real population above the threshold
        return (r.population ?? 0) >= MIN_POPULATION;
      })
      // Dedupe by "name + country" so we don't show the same city twice
      .filter((r, i, arr) =>
        arr.findIndex(
          (x) => x.name === r.name && x.country_code === r.country_code
        ) === i
      )
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        name: r.name,
        country: r.country ?? "",
        country_code: r.country_code ?? "",
        admin1: r.admin1,
        population: r.population,
        lat: r.latitude,
        lon: r.longitude,
      }));

    return NextResponse.json({ results: suggestions });
  } catch (err) {
    console.warn("[/api/cities] error:", err);
    return NextResponse.json({ results: [] });
  }
}
