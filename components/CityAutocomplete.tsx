"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitySuggestion {
  id: number;
  name: string;
  country: string;
  country_code: string;
  admin1?: string;
  population?: number;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
}

function countryFlag(cc: string): string {
  if (!cc || cc.length !== 2) return "";
  const codePoints = cc
    .toUpperCase()
    .split("")
    .map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "e.g. Kyiv",
}: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [justSelected, setJustSelected] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch suggestions (debounced) whenever value changes
  useEffect(() => {
    if (justSelected) {
      setJustSelected(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      // Abort any in-flight request before starting a new one
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/cities?q=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = (await res.json()) as { results: CitySuggestion[] };
        setSuggestions(data.results);
        setOpen(data.results.length > 0);
        setActiveIdx(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // We deliberately only react to `value` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectCity = useCallback(
    (s: CitySuggestion) => {
      onChange(s.name);
      setJustSelected(true);
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectCity(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const hasSuggestions = useMemo(
    () => open && suggestions.length > 0,
    [open, suggestions.length]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full"
    >
      <label className="group flex flex-col gap-1 text-left bg-white/5 hover:bg-white/[0.08] transition-colors rounded-2xl px-4 py-3 cursor-text border border-transparent hover:border-white/10 focus-within:border-sand-400/40 focus-within:bg-white/[0.08]">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-white/50">
          <MapPin className="w-4 h-4 text-sand-400" />
          Destination
        </div>
        <div className="flex items-center">
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-white placeholder:text-white/30 text-sm font-medium focus:outline-none"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin ml-2" />}
        </div>
      </label>

      {/* Suggestions dropdown */}
      {hasSuggestions && (
        <div
          role="listbox"
          className="absolute z-30 left-0 right-0 mt-2 rounded-2xl overflow-hidden glass-dark shadow-card animate-fade-in"
        >
          {suggestions.map((s, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => {
                  // mousedown fires before input blur, so selection works
                  e.preventDefault();
                  selectCity(s);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  "border-b border-white/5 last:border-b-0",
                  isActive ? "bg-sand-400/15" : "hover:bg-white/5"
                )}
              >
                <span className="text-xl leading-none flex-shrink-0 w-6 text-center">
                  {countryFlag(s.country_code) || "🏙"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{s.name}</div>
                  <div className="text-xs text-white/50 truncate">
                    {[s.admin1, s.country].filter(Boolean).join(", ")}
                  </div>
                </div>
                {typeof s.population === "number" && s.population > 0 && (
                  <span className="text-[10px] text-white/30 flex-shrink-0">
                    {formatPop(s.population)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
