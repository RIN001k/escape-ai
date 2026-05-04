import type { Hotel } from "@/types";

const RAPIDAPI_HOST = "booking-com15.p.rapidapi.com";
const BASE = `https://${RAPIDAPI_HOST}/api/v1`;

function buildHeaders(): HeadersInit {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("Missing RAPIDAPI_KEY env variable");
  return {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": RAPIDAPI_HOST,
  };
}

interface RawDestination {
  dest_id?: string | number;
  search_type?: string;
  name?: string;
  cc1?: string;
}

async function searchDestination(city: string): Promise<RawDestination | null> {
  const url = `${BASE}/hotels/searchDestination?query=${encodeURIComponent(city)}`;
  const res = await fetch(url, {
    headers: buildHeaders(),
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    console.warn(`[hotel-api] searchDestination failed for "${city}": ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { data?: RawDestination[] };
  const results = json.data ?? [];
  const city_match = results.find(
    (r) => r.search_type === "city" || r.search_type === "CITY"
  );
  return city_match ?? results[0] ?? null;
}

interface RawPriceBreakdown {
  grossPrice?: { value?: number; currency?: string };
}

interface RawProperty {
  name?: string;
  reviewScore?: number;
  priceBreakdown?: RawPriceBreakdown;
  photoUrls?: string[];
  countryCode?: string;
  url?: string;
}

interface RawHotel {
  hotel_id?: number | string;
  property?: RawProperty;
  url?: string;
}

async function searchHotels(
  dest: RawDestination,
  opts: { arrival_date: string; departure_date: string; maxPrice?: number; adults: number }
): Promise<RawHotel[]> {
  const params = new URLSearchParams({
    dest_id: String(dest.dest_id ?? ""),
    search_type: (dest.search_type ?? "CITY").toUpperCase(),
    arrival_date: opts.arrival_date,
    departure_date: opts.departure_date,
    adults: String(opts.adults),
    room_qty: "1",
    page_number: "1",
    units: "metric",
    temperature_unit: "c",
    languagecode: "en-us",
    currency_code: "USD",
  });
  if (opts.maxPrice && opts.maxPrice > 0) {
    params.set("price_max", String(opts.maxPrice));
  }

  const url = `${BASE}/hotels/searchHotels?${params}`;
  const res = await fetch(url, {
    headers: buildHeaders(),
    // Don't cache — prices are date/guest-sensitive
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`[hotel-api] searchHotels failed: ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { data?: { hotels?: RawHotel[] } };
  return json.data?.hotels ?? [];
}

function normalizeHotel(raw: RawHotel, city: string): Hotel | null {
  const p = raw.property ?? {};
  const name = p.name?.trim();
  const price = p.priceBreakdown?.grossPrice?.value;
  if (!name || !price) return null;

  // Booking review score is 0–10 → convert to 5-star scale
  const rating =
    typeof p.reviewScore === "number"
      ? Math.max(1, Math.min(5, Math.round((p.reviewScore / 2) * 10) / 10))
      : 4;

  // Prefer a URL returned directly by the API; slug-based construction is
  // unreliable because Booking.com's internal slugs differ from the hotel name.
  const booking_url = raw.property?.url ?? raw.url ?? undefined;

  return {
    name,
    rating,
    price_per_night: Math.round(price),
    currency: p.priceBreakdown?.grossPrice?.currency ?? "USD",
    hotel_id: raw.hotel_id,
    booking_query: `${name} ${city}`,
    booking_url,
    image_url:
      Array.isArray(p.photoUrls) && p.photoUrls.length > 0
        ? p.photoUrls[0]
        : undefined,
    source: "booking",
  };
}

export interface HotelSearchOpts {
  arrival_date: string;
  departure_date: string;
  adults: number;
  maxPrice?: number;
  count?: number;
}

/**
 * Fetch real hotels from Booking.com (via RapidAPI).
 * Uses the exact dates and guest count from the user's search.
 * Returns an empty array on any failure — caller falls back to AI data.
 */
export async function getRealHotels(
  city: string,
  opts: HotelSearchOpts
): Promise<Hotel[]> {
  try {
    const dest = await searchDestination(city);
    if (!dest) return [];

    const raws = await searchHotels(dest, {
      arrival_date: opts.arrival_date,
      departure_date: opts.departure_date,
      maxPrice: opts.maxPrice,
      adults: opts.adults,
    });

    const hotels = raws
      .map((r) => normalizeHotel(r, city))
      .filter((h): h is Hotel => h !== null);

    // Dedupe by hotel_id → never return the same hotel twice
    const seen = new Set<string>();
    const unique = hotels.filter((h) => {
      const key = String(h.hotel_id ?? h.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.slice(0, opts.count ?? 1);
  } catch (err) {
    console.warn("[hotel-api] getRealHotels error:", err);
    return [];
  }
}
