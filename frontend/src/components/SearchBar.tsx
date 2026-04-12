import { Search, Star, ChevronDown } from "lucide-react";
import { Input } from "./input";
import { useMemo, useState } from "react";

const CITY_PLACEHOLDER = "City";

const CITY_OPTIONS = [
  CITY_PLACEHOLDER,
  "Philadelphia",
  "Tampa",
  "Indianapolis",
  "Nashville",
  "Tucson",
  "New Orleans",
  "Edmonton",
  "Saint Louis",
  "Reno",
  "Boise",
];

interface SearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  rating: number;
  onRatingChange: (value: number) => void;
  price: string;
  onPriceChange: (value: string) => void;
  onSubmit?: (payload: { city: string; query: string; rating: number; price: string }) => void;
  autoSubmitOnFilterChange?: boolean;
  placeholder?: string;
}

export function SearchBar({
  query,
  onQueryChange,
  city,
  onCityChange,
  onSubmit,
  rating,
  onRatingChange,
  price,
  onPriceChange,
  autoSubmitOnFilterChange = false,
  placeholder,
}: SearchBarProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const prices = ["Price", "$", "$$", "$$$", "$$$$"];
  const suggestions = ["Nashville cozy matcha", "Tampa romantic Italian", "Philadelphia trendy sushi"];

  const trimmedQuery = query.trim();
  const isCitySelected = city !== CITY_PLACEHOLDER && city !== "";
  const canSubmit = isCitySelected && trimmedQuery.length > 0;

  const submitWith = (nextCity: string, nextQuery: string, nextRating: number = rating, nextPrice: string = price) => {
    if (!onSubmit) return;
    const cleanQuery = nextQuery.trim();
    const hasCity = nextCity !== CITY_PLACEHOLDER && nextCity !== "";
    if (!hasCity || cleanQuery.length === 0) return;
    onSubmit({ city: nextCity, query: cleanQuery, rating: nextRating, price: nextPrice });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWith(city, trimmedQuery, rating, price);
  };

  const orderedCities = useMemo(
    () => CITY_OPTIONS.filter((c) => c !== CITY_PLACEHOLDER).sort((a, b) => b.length - a.length),
    []
  );

  const handleSuggestionClick = (suggestion: string) => {
    setSelectedSuggestion(suggestion);
    let nextCity = city;
    let nextQuery = suggestion;
    const match = orderedCities.find((c) => suggestion.toLowerCase().startsWith(c.toLowerCase()));
    if (match) {
      nextCity = match;
      const remainder = suggestion.slice(match.length).trimStart();
      if (remainder) {
        nextQuery = remainder;
      }
      onCityChange(match);
    }

    const resetRating = 0;
    const resetPrice = "Price";
    if (rating !== resetRating) {
      onRatingChange(resetRating);
    }
    if (price !== resetPrice) {
      onPriceChange(resetPrice);
    }

    onQueryChange(nextQuery);
    submitWith(nextCity, nextQuery, resetRating, resetPrice);
  };

  const maybeAutoSubmit = (nextRating: number, nextPrice: string) => {
    if (!autoSubmitOnFilterChange) return;
    submitWith(city, query, nextRating, nextPrice);
  };

  const handleRatingInput = (value: number) => {
    onRatingChange(value);
    maybeAutoSubmit(value, price);
  };

  const handlePriceInput = (value: string) => {
    onPriceChange(value);
    maybeAutoSubmit(rating, value);
  };

  const normalizedCity = useMemo(() => {
    if (CITY_OPTIONS.includes(city)) return city;
    return CITY_PLACEHOLDER;
  }, [city]);

  return (
    <form className="w-full space-y-4" onSubmit={handleSubmit}>
      {/* Main Search Row */}
      <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
        {/* City Dropdown */}
        <div className="relative">
          <select
            value={normalizedCity}
            onChange={(e) => onCityChange(e.target.value)}
            className="appearance-none pl-5 pr-10 py-2.5 rounded-full border-2 border-red-200 bg-white text-sm text-gray-700 cursor-pointer hover:border-red-300 transition-colors min-w-[120px]"
          >
            {CITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Search Input */}
        <div className="flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder || "Try 'cozy Italian' or 'spicy ramen'..."}
            className="h-12 text-base rounded-full border-2 border-red-200 focus:border-red-400 transition-colors shadow-sm px-4"
          />
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-full p-3 hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Search"
        >
          <Search className="size-5" />
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-center gap-4 flex-wrap">
        {/* Star Rating Scrubber */}
        <div className="flex items-center gap-3">
          <div className="relative w-32 pb-1">
            <div className="relative h-2 flex items-center">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={rating}
                onChange={(e) => handleRatingInput(parseFloat(e.target.value))}
                className="w-full h-2 bg-red-100 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-transparent
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:bg-transparent
                  [&::-moz-range-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:border-0"
                style={{
                  background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(rating / 5) * 100}%, #fee2e2 ${(rating / 5) * 100}%, #fee2e2 100%)`
                }}
              />
              <Star
                className="size-5 text-red-600 fill-red-600 absolute top-1/2 -translate-y-1/2 pointer-events-none transition-all z-10"
                style={{ left: `calc(${(rating / 5) * 100}% - 10px)` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500 mt-1 relative">
              <span>0</span>
              <span className="absolute left-1/2 -translate-x-1/2">{rating.toFixed(1)}</span>
              <span>5</span>
            </div>
          </div>
        </div>

        {/* Price Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={price}
              onChange={(e) => handlePriceInput(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-full border-2 border-red-200 bg-white text-sm text-gray-700 cursor-pointer hover:border-red-300 transition-colors"
            >
              {prices.map((price) => (
                <option key={price} value={price}>
                  {price}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Suggested Search Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {suggestions.map((suggestion, index) => {
            const pillColors = [
              "bg-red-100 border-2 border-red-300 text-red-700 hover:bg-red-200",
              "bg-rose-100 border-2 border-rose-300 text-rose-700 hover:bg-rose-200",
              "bg-pink-100 border-2 border-pink-300 text-pink-700 hover:bg-pink-200",
              "bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100",
            ];
            const colorIndex = index % pillColors.length;

            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  selectedSuggestion === suggestion
                    ? "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md"
                    : pillColors[colorIndex]
                }`}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
