import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getRealHotels } from "@/lib/hotel-api";
import { getCityImage, getImageCandidates } from "@/lib/city-image";
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
- An ICONIC LANDMARK OR SCENE in ${city} that matches the vibe — used for the image (e.g., "${city} old town square", "${city} riverfront at sunset", "${city} cathedral interior"). Each image_query MUST reference a DIFFERENT landmark or scene of ${city} so the 3 photos look different.

Return a valid JSON array of 3 trip objects. Strict schema:
{
  id: string,
  title: string,                     // max 6 words
  destination: string,               // "${city}, <country>"
  city: string,                      // "${city}"
  country: string,
  description: string,               // 2 poetic sentences
  image_query: string,               // must include "${city}" + a distinct landmark keyword
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
- The 3 image_query values must reference 3 DIFFERENT landmarks/scenes of ${city}.
- Return ONLY the raw JSON array. No markdown.`;
}

async function resolveUniqueHeroImage(
  trip: Trip,
  used: Set<string>
): Promise<string | null> {
  const query = trip.image_query?.trim() || `${trip.city} landmark`;
  const candidates = await getImageCandidates(query, 5);
  for (const url of candidates) {
    if (!used.has(url)) {
      used.add(url);
      return url;
    }
  }
  return null;
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

    // 2. Fetch real hotels per city — one batched call, N hotels per city.
    const hasRapidKey = Boolean(process.env.RAPIDAPI_KEY);
    const hotelsByCity = new Map<string, Hotel[]>();

    if (hasRapidKey) {
      const cityCounts = new Map<string, { city: string; count: number }>();
      for (const trip of trips) {
        const key = trip.city.toLowerCase();
        const entry = cityCounts.get(key) ?? { city: trip.city, count: 0 };
        entry.count += 1;
        cityCounts.set(key, entry);
      }
      await Promise.all(
        [...cityCounts.entries()].map(async ([key, { city, count }]) => {
          const hotels = await getRealHotels(city, {
            days: body.days,
            maxPrice: body.accommodation_budget,
            count,
          });
          hotelsByCity.set(key, hotels);
        })
      );
    }

    // 3. Resolve unique hero images (one Wikipedia search per trip, deduped).
    const usedImages = new Set<string>();
    const heroImages = await Promise.all(
      trips.map((t) => resolveUniqueHeroImage(t, usedImages))
    );

    // 4. Fallback shared city photo for any trip that didn't get a unique hero.
    const cityFallback = await getCityImage(trips[0].city, trips[0].country);

    // 5. Merge everything.
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

      const hero = heroImages[i] ?? cityFallback ?? undefined;

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
