export interface Activity {
  title: string;
  description: string;
  duration?: string;
  price_estimate?: string;
}

export interface Hotel {
  name: string;
  rating: number;
  price_per_night: number;
  currency?: string;
  booking_query: string;
  booking_url?: string;
  hotel_id?: string | number;
  image_url?: string;
  amenities?: string[];
  source?: "booking" | "ai";
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  city: string;
  country: string;
  description: string;
  image_url?: string;
  image_query?: string;
  city_image_url?: string;
  vibe?: string;
  activities: Activity[];
  hotel: Hotel;
  estimated_total?: number;
}

export interface GenerateRequest {
  city: string;
  days: number;
  accommodation_budget: number;
  activity_budget: number;
  check_in: string;        // YYYY-MM-DD
  check_out: string;       // YYYY-MM-DD
  guests: number;
  departure_city?: string;
}

export interface GenerateResponse {
  trips: Trip[];
  error?: string;
}
