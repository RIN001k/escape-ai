"use client";

import {
  Star,
  MapPin,
  Hotel,
  Plane,
  Clock,
  DollarSign,
  Wifi,
  Waves,
  Sparkles,
  ChevronDown,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { useState } from "react";
import type { Trip } from "@/types";
import { cn } from "@/lib/utils";

function buildImageUrl(trip: Trip): string | null {
  // Hero must always be a CITY photo (never a hotel room).
  // The server populates image_url with a real city/landmark photo from
  // Wikimedia Commons. city_image_url is a shared fallback.
  return trip.image_url ?? trip.city_image_url ?? null;
}

function buildBookingUrl(trip: Trip): string {
  if (trip.hotel.booking_url) return trip.hotel.booking_url;
  // AI hotels are fictional — search the city so user sees actually available hotels.
  // For real Booking hotels without a direct URL, also search city to avoid landing
  // on a hotel page that shows "unavailable for these dates".
  const query = trip.hotel.source === "ai"
    ? trip.city
    : (trip.hotel.booking_query || trip.city);
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
}

const VIBE_COLORS: Record<string, string> = {
  Romantic:  "from-rose-500/20 to-pink-500/20 border-rose-400/30 text-rose-300",
  Adventure: "from-emerald-500/20 to-teal-500/20 border-emerald-400/30 text-emerald-300",
  Cultural:  "from-violet-500/20 to-purple-500/20 border-violet-400/30 text-violet-300",
  Wellness:  "from-sky-500/20 to-blue-500/20 border-sky-400/30 text-sky-300",
  Foodie:    "from-amber-500/20 to-orange-500/20 border-amber-400/30 text-amber-300",
};

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  "Free WiFi": <Wifi className="w-3 h-3" />,
  Pool:        <Waves className="w-3 h-3" />,
  Spa:         <Sparkles className="w-3 h-3" />,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i < Math.floor(rating)
              ? "fill-sand-400 text-sand-400"
              : "fill-transparent text-white/20"
          )}
        />
      ))}
    </div>
  );
}

interface TripCardProps {
  trip: Trip;
  index: number;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  departureCity?: string;
}

export function TripCard({
  trip,
  index,
  checkIn,
  checkOut,
  guests = 2,
  departureCity,
}: TripCardProps) {
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const vibeClass =
    VIBE_COLORS[trip.vibe ?? ""] ??
    "from-white/10 to-white/5 border-white/20 text-white/70";

  const imgSrc = buildImageUrl(trip);
  const isLiveHotel = trip.hotel.source === "booking";

  // Booking.com — include real dates and guest count when available
  const bookingUrl = (() => {
    if (trip.hotel.booking_url && checkIn && checkOut) {
      const u = new URL(trip.hotel.booking_url);
      u.searchParams.set("checkin", checkIn);
      u.searchParams.set("checkout", checkOut);
      u.searchParams.set("group_adults", String(guests));
      return u.toString();
    }
    const base = buildBookingUrl(trip);
    const u = new URL(base);
    if (checkIn) u.searchParams.set("checkin", checkIn);
    if (checkOut) u.searchParams.set("checkout", checkOut);
    u.searchParams.set("group_adults", String(guests));
    return u.toString();
  })();

  // Google Flights — from departure city to destination with dates
  const flightsUrl = (() => {
    const from = departureCity ? encodeURIComponent(departureCity) : "";
    const to = encodeURIComponent(trip.city);
    if (from && checkIn) {
      return `https://www.google.com/travel/flights?q=Flights+from+${from}+to+${to}+on+${checkIn}${checkOut ? `+returning+${checkOut}` : ""}`;
    }
    return `https://www.google.com/travel/flights?q=Flights+to+${to}`;
  })();

  return (
    <article
      className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/5 border border-white/10 shadow-card hover:shadow-card-hover transition-all duration-500 hover:-translate-y-1"
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {/* Hero Image */}
      <div className="relative h-64 overflow-hidden bg-gradient-to-br from-indigo-900 via-stone-900 to-rose-900">
        {imgSrc && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={trip.destination}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <ImageIcon className="w-10 h-10" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Vibe badge */}
        {trip.vibe && (
          <div
            className={cn(
              "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md bg-gradient-to-r",
              vibeClass
            )}
          >
            {trip.vibe}
          </div>
        )}

        {/* Estimated total */}
        {trip.estimated_total && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold bg-black/50 border border-white/20 backdrop-blur-md text-white/90">
            est. ${trip.estimated_total.toLocaleString()}
          </div>
        )}

        {/* Destination */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-1.5 text-white/70 text-sm mb-1">
            <MapPin className="w-3.5 h-3.5 text-sand-400 flex-shrink-0" />
            <span>{trip.destination}</span>
          </div>
          <h2 className="text-xl font-display font-bold text-white leading-tight">
            {trip.title}
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-6 gap-5">

        {/* Description */}
        <p className="text-sm text-white/60 leading-relaxed">{trip.description}</p>

        {/* Hotel */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Hotel className="w-4 h-4 text-sand-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-sand-400 uppercase tracking-wider">
                  Recommended Stay
                </span>
                {isLiveHotel && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-[9px] font-semibold uppercase tracking-wider">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-white font-semibold text-sm truncate">{trip.hotel.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <StarRating rating={trip.hotel.rating} />
                <span className="text-white/40 text-xs">·</span>
                <span className="text-white/60 text-xs">{trip.hotel.rating}-star</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="flex items-center justify-end gap-0.5 text-sand-300">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-lg font-bold">{trip.hotel.price_per_night}</span>
              </div>
              <p className="text-white/40 text-xs">per night</p>
            </div>
          </div>

          {/* Amenities */}
          {trip.hotel.amenities && trip.hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {trip.hotel.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs"
                >
                  {AMENITY_ICONS[amenity]}
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Activities accordion */}
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setActivitiesOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-semibold text-white/90">
              {trip.activities.length} Activities
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-white/40 transition-transform duration-300",
                activitiesOpen && "rotate-180"
              )}
            />
          </button>

          {activitiesOpen && (
            <div className="divide-y divide-white/5 border-t border-white/10">
              {trip.activities.map((activity, i) => (
                <div key={i} className="px-4 py-3 space-y-1">
                  <p className="text-sm font-medium text-white/90">{activity.title}</p>
                  <p className="text-xs text-white/50 leading-relaxed">{activity.description}</p>
                  <div className="flex items-center gap-3 pt-0.5">
                    {activity.duration && (
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Clock className="w-3 h-3" />
                        {activity.duration}
                      </span>
                    )}
                    {activity.price_estimate && (
                      <span className="flex items-center gap-1 text-xs text-sand-400/80">
                        <DollarSign className="w-3 h-3" />
                        {activity.price_estimate}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-3 mt-auto pt-1">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-sand-400 hover:bg-sand-300 text-stone-900 text-sm font-semibold transition-all duration-200 hover:shadow-glow active:scale-95"
          >
            <Hotel className="w-4 h-4" />
            Book Hotel
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
          <a
            href={flightsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/15 transition-all duration-200 active:scale-95"
          >
            <Plane className="w-4 h-4" />
            Find Flights
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
        </div>
      </div>
    </article>
  );
}
