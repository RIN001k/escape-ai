import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getRealHotels } from "@/lib/hotel-api";
import {
  getCityImage,
  getCommonsCityImages,
  pickDistinct,
} from "@/lib/city-image";
import type { GenerateRequest, Hotel, Trip } from "@/types";

function buildPrompt(req: GenerateRequest): string {
  const city = req.city.trim();
  return `You are a world-class luxury travel agent curating weekend getaways.

=== USER REQUEST (FOLLOW EXACTLY) ===
- Destination the traveler wants to visit: "${city}"
- Trip length: ${req.days} days
- Max hotel budget: $${req.accommodation_budget}/night
- Total activity budget: $${req.activity_budget}

CRITICAL: All 3 trip options MUST take place in "${city}". Do NOT suggest any other city. Every trip's "city" = "${city}", "destination" = "${city}, <country>".

The 3 options must differ in:
- VIBE (each a different one from: Romantic, Adventure, Cultural, Wellness, Foodie)
- NEIGHBORHOOD / DISTRICT of ${city}
- The activities and hotel chosen

Return a valid JSON array of 3 trip objects. Strict schema:
{
  id: string,
  title: string,                     // max 6 words
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
    rating: number,                  // 1-5
    price_per_night: number,         // <= ${req.accommodation_budget}
    currency: "USD",
    booking_query: string,
    amenities: string[]
  },
  estimated_total: number
}

Rules:
- Every trip is IN ${city}.
- Hotel price_per_night MUST be <= ${req.accommodation_budget}.
- Return ONLY the raw JSON array. No markdown.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.city?.trim()) {
      return NextResponse.json({ error: "Starting city is required." }, { status: 400 });
    }
    if (body.days < 2 || body.days > 5) {
      return NextResponse.json({ error: "Days must be between 2 and 5." }, { status: 400 });
    }

    console.log("[/api/generate] received:", body);

    // 1. Ask Gemini for 3 trip options
    const text = await generateJSON(buildPrompt(body));
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

    // 2. Group trips by city for batched hotel + image fetching.
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

    // 3. For each unique city, fetch BOTH:
    //    - real hotels from Booking (optional, requires RapidAPI key)
    //    - a pool of photos from Wikimedia Commons (always, free)
    const hasRapidKey = Boolean(process.env.RAPIDAPI_KEY);
    const hotelsByCity = new Map<string, Hotel[]>();
    const heroByTripIdx = new Map<number, string>();

    await Promise.all(
      citiesInOrder.map(async (city) => {
        const key = city.toLowerCase();
        const tripIndices = cityToTripIdx.get(key)!;
        const count = tripIndices.length;

        const [hotels, commonsPool] = await Promise.all([
          hasRapidKey
            ? getRealHotels(city, {
                days: body.days,
                maxPrice: body.accommodation_budget,
                count,
              })
            : Promise.resolve([] as Hotel[]),
          getCommonsCityImages(city),
        ]);

        hotelsByCity.set(key, hotels);

        // Pick N distinct images for this city and assign one to each trip.
        const picks = pickDistinct(commonsPool, count);
        tripIndices.forEach((tripIdx, i) => {
          if (picks[i]) heroByTripIdx.set(tripIdx, picks[i]);
        });
      })
    );

    // 4. Shared city summary photo as a last-resort fallback.
    const cityFallback = await getCityImage(trips[0].city, trips[0].country);

    // 5. Merge everything into the final trip objects.
    //    IMPORTANT: hero image is ALWAYS a city photo (Commons / Wikipedia).
    //    Real hotel photos are preserved on `hotel.image_url` but NEVER used as hero.
    const enriched: Trip[] = trips.map((trip, i) => {
      const pool = hotelsByCity.get(trip.city.toLowerCase()) ?? [];
      const realHotel = pool.shift();

      const mergedHotel = realHotel
        ? {
            ...trip.hotel,
            ...realHotel,
            amenities: realHotel.amenities ?? trip.hotel.amenities,
          }
        : { ...trip.hotel, source: "ai" as const };

      const hero = heroByTripIdx.get(i) ?? cityFallback ?? undefined;

      return {
        ...trip,
        image_url: hero,
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
