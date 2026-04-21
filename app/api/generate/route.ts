import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getRealHotels } from "@/lib/hotel-api";
import {
  getCityImage,
  getCommonsCityImages,
  pickDistinct,
} from "@/lib/city-image";
import type { GenerateRequest, Hotel, Trip } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildPrompt(req: GenerateRequest): string {
  const city = req.city.trim();
  return `You are a world-class luxury travel agent curating weekend getaways.

=== USER REQUEST (FOLLOW EXACTLY) ===
- Destination the traveler wants to visit: "${city}"
- Check-in: ${req.check_in} | Check-out: ${req.check_out} (${req.days} nights)
- Guests: ${req.guests} adult(s)
- Max hotel budget: $${req.accommodation_budget}/night
- Total activity budget: $${req.activity_budget}

CRITICAL: All 3 trip options MUST take place in "${city}". Do NOT suggest any other city.

The 3 options must differ in VIBE, NEIGHBORHOOD, hotel choice, and activities.

Return a valid JSON array of 3 trip objects:
{
  id: string,
  title: string,
  destination: string,               // "${city}, <country>"
  city: string,                      // "${city}"
  country: string,
  description: string,               // 2 poetic sentences
  vibe: "Romantic" | "Adventure" | "Cultural" | "Wellness" | "Foodie",
  activities: [
    { title: string, description: string, duration: string, price_estimate: string }
  ],
  hotel: {
    name: string,
    rating: number,
    price_per_night: number,         // <= ${req.accommodation_budget}
    currency: "USD",
    booking_query: string,
    amenities: string[]
  },
  estimated_total: number
}

Rules: every trip is IN ${city}. Hotel price_per_night <= ${req.accommodation_budget}. Return ONLY raw JSON.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.city?.trim()) {
      return NextResponse.json({ error: "Destination city is required." }, { status: 400 });
    }
    if (!body.check_in || !body.check_out) {
      return NextResponse.json({ error: "Check-in and check-out dates are required." }, { status: 400 });
    }

    // Compute nights from dates
    const msPerDay = 86_400_000;
    const nights = Math.round(
      (new Date(body.check_out).getTime() - new Date(body.check_in).getTime()) / msPerDay
    );
    if (nights < 1 || nights > 14) {
      return NextResponse.json({ error: "Trip must be between 1 and 14 nights." }, { status: 400 });
    }

    const enrichedBody: GenerateRequest = { ...body, days: nights };

    console.log("[/api/generate] received:", {
      city: body.city,
      check_in: body.check_in,
      check_out: body.check_out,
      nights,
      guests: body.guests,
      accommodation_budget: body.accommodation_budget,
      activity_budget: body.activity_budget,
      departure_city: body.departure_city,
    });

    // 1. Gemini: generate 3 trip options
    const text = await generateJSON(buildPrompt(enrichedBody));
    let trips: Trip[];
    try {
      trips = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
      trips = JSON.parse(cleaned);
    }
    if (!Array.isArray(trips) || trips.length === 0) {
      return NextResponse.json({ error: "AI returned an unexpected response." }, { status: 500 });
    }

    // 2. Group trips by city for batched hotel + image fetching
    const hasRapidKey = Boolean(process.env.RAPIDAPI_KEY);
    const hotelsByCity = new Map<string, Hotel[]>();
    const heroByTripIdx = new Map<number, string>();

    const citiesInOrder: string[] = [];
    const cityToTripIdx = new Map<string, number[]>();
    trips.forEach((t, idx) => {
      const key = t.city.toLowerCase();
      if (!cityToTripIdx.has(key)) {
        citiesInOrder.push(t.city);
        cityToTripIdx.set(key, []);
      }
      cityToTripIdx.get(key)!.push(idx);
    });

    await Promise.all(
      citiesInOrder.map(async (city) => {
        const key = city.toLowerCase();
        const tripIndices = cityToTripIdx.get(key)!;
        const count = tripIndices.length;

        const [hotels, commonsPool] = await Promise.all([
          hasRapidKey
            ? getRealHotels(city, {
                arrival_date: body.check_in,
                departure_date: body.check_out,
                adults: body.guests ?? 2,
                maxPrice: body.accommodation_budget,
                count,
              })
            : Promise.resolve([] as Hotel[]),
          getCommonsCityImages(city),
        ]);

        hotelsByCity.set(key, hotels);

        const picks = pickDistinct(commonsPool, count);
        tripIndices.forEach((tripIdx, i) => {
          if (picks[i]) heroByTripIdx.set(tripIdx, picks[i]);
        });
      })
    );

    // 3. Shared city fallback photo
    const cityFallback = await getCityImage(trips[0].city, trips[0].country);

    // 4. Merge: hero = city photo (never hotel room), hotel = live data from Booking
    const enriched: Trip[] = trips.map((trip, i) => {
      const pool = hotelsByCity.get(trip.city.toLowerCase()) ?? [];
      const realHotel = pool.shift();

      const mergedHotel = realHotel
        ? { ...trip.hotel, ...realHotel, amenities: realHotel.amenities ?? trip.hotel.amenities }
        : { ...trip.hotel, source: "ai" as const };

      return {
        ...trip,
        image_url: heroByTripIdx.get(i) ?? cityFallback ?? undefined,
        city_image_url: cityFallback ?? undefined,
        hotel: mergedHotel,
      };
    });

    return NextResponse.json({ trips: enriched });
  } catch (err: unknown) {
    console.error("[/api/generate] Error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
