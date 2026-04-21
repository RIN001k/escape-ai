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

/** Next Friday -> Friday + days. Gives us a realistic weekend window. */
function nextWeekendRange(days: number): { arrival: string; departure: string } {
  const now = new Date();
  const daysUntilFri = ((5 - now.getDay() + 7) % 7) || 7;
  const arrival = new Date(now);
  arrival.setDate(now.getDate() + daysUntilFri);
  const departure = new Date(arrival);
  departure.setDate(arrival.getDate() + Math.max(1, days));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { arrival: iso(arrival), departure: iso(departure) };
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
    next: { revalidate: 86400 }, // destinations rarely change
  });
  if (!res.ok) {
    console.warn(`[hotel-api] searchDestination failed for "${city}": ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { data?: RawDestination[] };
  // Prefer CITY-type results over landmarks/regions
  const results = json.data ?? [];
  const city_match = results.find((r) => r.search_type === "city" || r.search_type === "CITY");
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
  wishlistName?: string;
  countryCode?: string;
  ufi?: number;
}

interface RawHotel {
  hotel_id?: number | string;
  property?: RawProperty;
  accessibilityLabel?: string;
}

async function searchHotels(
  dest: RawDestination,
  days: number,
  maxPrice?: number
): Promise<RawHotel[]> {
  const { arrival, departure } = nextWeekendRange(days);
  const params = new URLSearchParams({
    dest_id: String(dest.dest_id ?? ""),
    search_type: (dest.search_type ?? "CITY").toUpperCase(),
    arrival_date: arrival,
    departure_date: departure,
    adults: "2",
    room_qty: "1",
    page_number: "1",
    units: "metric",
    temperature_unit: "c",
    languagecode: "en-us",
    currency_code: "USD",
  });
  if (maxPrice && maxPrice > 0) params.set("price_max", String(maxPrice));

  const url = `${BASE}/hotels/searchHotels?${params}`;
  const res = await fetch(url, {
    headers: buildHeaders(),
    next: { revalidate: 3600 },
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

  // Booking review score is 0-10 → convert to 5-star scale
  const rating =
    typeof p.reviewScore === "number"
      ? Math.max(1, Math.min(5, Math.round((p.reviewScore / 2) * 10) / 10))
      : 4;

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const booking_url =
    raw.hotel_id && p.countryCode
      ? `https://www.booking.com/hotel/${p.countryCode}/${slug}.html`
      : undefined;

  return {
    name,
    rating,
    price_per_night: Math.round(price),
    currency: p.priceBreakdown?.grossPrice?.currency ?? "USD",
    hotel_id: raw.hotel_id,
    booking_query: `${name} ${city}`,
    booking_url,
    image_url: Array.isArray(p.photoUrls) && p.photoUrls.length > 0 ? p.photoUrls[0] : undefined,
    source: "booking",
  };
}

/**
 * Fetch real hotels from Booking.com (via RapidAPI) for a given city.
 * Returns an empty array on any failure — caller should fall back to AI data.
 */
export async function getRealHotels(
  city: string,
  opts: { days: number; maxPrice?: number; count?: number }
): Promise<Hotel[]> {
  try {
    const dest = await searchDestination(city);
    if (!dest) return [];
    const raws = await searchHotels(dest, opts.days, opts.maxPrice);
    const hotels = raws
      .map((r) => normalizeHotel(r, city))
      .filter((h): h is Hotel => h !== null);
    // Dedupe by hotel_id (fallback to name) so we never return the same place twice.
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
