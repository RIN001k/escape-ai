"use client";

import { useState, type FormEvent } from "react";
import {
  Calendar,
  BedDouble,
  Ticket,
  Sparkles,
  Loader2,
  Compass,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { TripCard } from "@/components/TripCard";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import type { GenerateRequest, Trip } from "@/types";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const [form, setForm] = useState<GenerateRequest>({
    city: "",
    days: 3,
    accommodation_budget: 250,
    activity_budget: 400,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.city.trim()) {
      setError("Please enter your starting city.");
      return;
    }

    setLoading(true);
    setError(null);
    setTrips(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setTrips(data.trips);

      // Smoothly scroll to results after they render
      setTimeout(() => {
        document
          .getElementById("results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate trips.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen">
      {/* NAV */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sand-300 to-sand-500 flex items-center justify-center shadow-glow">
            <Compass className="w-5 h-5 text-stone-950" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            Weekend<span className="text-sand-400">.</span>ai
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-full glass text-xs text-white/70">
          <Sparkles className="w-3 h-3 text-sand-400" />
          Powered by Gemini 2.5
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-4xl w-full text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 text-xs text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI-curated · 3 unique itineraries in seconds
          </div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-[5.5rem] font-bold leading-[1.05] tracking-tight mb-6">
            Your Perfect Weekend
            <br />
            is <span className="text-gradient italic">One Click</span> Away
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-14">
            Tell us where you are and how much you want to spend.
            We&apos;ll design three unforgettable escapes — with hotels, activities, and vibe.
          </p>

          {/* GLASSMORPHISM FORM */}
          <form
            onSubmit={handleSubmit}
            className="glass rounded-[28px] p-2 shadow-glass max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              <CityAutocomplete
                value={form.city}
                onChange={(city) => setForm((prev) => ({ ...prev, city }))}
              />

              <FormField
                icon={<Calendar className="w-4 h-4" />}
                label="Days"
              >
                <select
                  value={form.days}
                  onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                  className="w-full bg-transparent text-white text-sm font-medium focus:outline-none appearance-none cursor-pointer"
                >
                  {[2, 3, 4, 5].map((d) => (
                    <option key={d} value={d} className="bg-stone-900">
                      {d} days
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                icon={<BedDouble className="w-4 h-4" />}
                label="Hotel / night"
              >
                <div className="flex items-center w-full">
                  <span className="text-white/50 text-sm mr-1">$</span>
                  <input
                    type="number"
                    min={50}
                    step={25}
                    value={form.accommodation_budget}
                    onChange={(e) =>
                      setForm({ ...form, accommodation_budget: Number(e.target.value) })
                    }
                    className="w-full bg-transparent text-white text-sm font-medium focus:outline-none"
                  />
                </div>
              </FormField>

              <FormField
                icon={<Ticket className="w-4 h-4" />}
                label="Activities"
              >
                <div className="flex items-center w-full">
                  <span className="text-white/50 text-sm mr-1">$</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={form.activity_budget}
                    onChange={(e) =>
                      setForm({ ...form, activity_budget: Number(e.target.value) })
                    }
                    className="w-full bg-transparent text-white text-sm font-medium focus:outline-none"
                  />
                </div>
              </FormField>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "group relative mt-2 w-full flex items-center justify-center gap-2",
                "py-4 rounded-2xl text-stone-950 font-semibold text-sm",
                "bg-gradient-to-r from-sand-300 via-sand-400 to-sand-300",
                "bg-[length:200%_100%] hover:bg-[length:200%_100%]",
                "transition-all duration-300 hover:shadow-glow active:scale-[0.99]",
                "disabled:opacity-70 disabled:cursor-not-allowed",
                !loading && "hover:animate-shimmer"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Crafting your escape…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate My Weekend
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-rose-500/10 border border-rose-400/30 text-rose-300 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Trust row */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/40" />
              Real bookable hotels
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/40" />
              Budget-aware
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-white/40" />
              No sign-up
            </span>
          </div>
        </div>
      </section>

      {/* RESULTS */}
      {(loading || trips) && (
        <section id="results" className="relative px-6 pb-32 pt-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12 animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sand-400 mb-3">
                {loading ? "Curating" : "Curated for you"}
              </p>
              <h2 className="font-display text-3xl md:text-5xl font-bold">
                {loading ? "Designing three escapes…" : "Three distinct escapes"}
              </h2>
              {!loading && trips && (
                <p className="mt-4 text-white/50 max-w-xl mx-auto">
                  Each option offers a unique personality. Pick the one that calls to you.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                : trips?.map((trip, i) => (
                    <div
                      key={trip.id}
                      className="animate-fade-up opacity-0"
                      style={{
                        animationDelay: `${i * 120}ms`,
                        animationFillMode: "forwards",
                      }}
                    >
                      <TripCard trip={trip} index={i} />
                    </div>
                  ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="relative px-6 py-10 text-center text-xs text-white/30 border-t border-white/5">
        <p>
          Weekend Escape AI — designed for wanderers. Prices and availability are AI-estimated.
        </p>
      </footer>
    </main>
  );
}

// ----- Small presentational helpers, kept local -----

function FormField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="group flex flex-col gap-1 text-left bg-white/5 hover:bg-white/8 transition-colors rounded-2xl px-4 py-3 cursor-text border border-transparent hover:border-white/10 focus-within:border-sand-400/40 focus-within:bg-white/8">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-white/50">
        <span className="text-sand-400">{icon}</span>
        {label}
      </div>
      <div className="flex items-center">{children}</div>
    </label>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden animate-pulse">
      <div className="h-64 bg-gradient-to-br from-white/5 to-white/10" />
      <div className="p-6 space-y-4">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-5/6" />
        <div className="h-24 bg-white/5 rounded-2xl mt-4" />
        <div className="flex gap-3">
          <div className="h-10 bg-white/10 rounded-xl flex-1" />
          <div className="h-10 bg-white/10 rounded-xl flex-1" />
        </div>
      </div>
    </div>
  );
}
