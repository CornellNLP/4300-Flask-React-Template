import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RestaurantCard, type Restaurant } from "../components/RestaurantCard";
import { UtensilsCrossed, Pizza, Coffee, IceCream, Cake, Cookie, Croissant, Sandwich, Cherry } from "lucide-react";
import dishcoveryLogo from "../assets/logo.png";

const CITY_PLACEHOLDER = "City";

const PRICE_PLACEHOLDER = "Price";

const formatPriceFromParam = (param: string | null): string => {
  if (!param || param === PRICE_PLACEHOLDER) return PRICE_PLACEHOLDER;
  if (/^\$+$/.test(param)) return param;
  const numeric = Number(param);
  if (Number.isNaN(numeric) || numeric <= 0) return PRICE_PLACEHOLDER;
  return "$".repeat(numeric);
};

const priceStringToTier = (price: string): number | null => {
  if (!price || price === PRICE_PLACEHOLDER) return null;
  if (/^\$+$/.test(price)) return price.length;
  const numeric = Number(price);
  return Number.isNaN(numeric) ? null : numeric;
};

const restaurantMatchesFilters = (restaurant: Restaurant, minRating: number, priceFilter: string): boolean => {
  const rating = restaurant.rating ?? restaurant.stars ?? 0;
  if (rating < minRating) return false;

  if (priceFilter === PRICE_PLACEHOLDER) return true;

  const tier = restaurant.priceTier ?? priceStringToTier(restaurant.priceRange ?? "");
  if (tier == null) return false;

  const targetTier = priceStringToTier(priceFilter);
  if (targetTier == null) return true;

  return tier === targetTier;
};

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") || "";
  const initialCity = searchParams.get("city") || CITY_PLACEHOLDER;
  const initialRating = Number(searchParams.get("rating") || "0");
  const initialPriceParam = searchParams.get("price");
  const initialPrice = formatPriceFromParam(initialPriceParam);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [ratingFilter, setRatingFilter] = useState(initialRating);
  const [priceFilter, setPriceFilter] = useState(initialPrice);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [activeCity, setActiveCity] = useState(initialCity);
  const [activeRating, setActiveRating] = useState(initialRating);
  const [activePrice, setActivePrice] = useState(initialPrice);
  const [results, setResults] = useState<Restaurant[]>([]);

  // Update search query when URL changes
  useEffect(() => {
    const queryParam = searchParams.get("q") || "";
    const cityParam = searchParams.get("city") || CITY_PLACEHOLDER;
    const ratingParam = Number(searchParams.get("rating") || "0");
    const priceParam = formatPriceFromParam(searchParams.get("price"));
    setSearchInput(queryParam);
    setSelectedCity(cityParam);
    setRatingFilter(ratingParam);
    setPriceFilter(priceParam);
    setActiveQuery(queryParam);
    setActiveCity(cityParam);
    setActiveRating(ratingParam);
    setActivePrice(priceParam);

    const trimmedQuery = queryParam.trim();
    const hasCity = cityParam !== CITY_PLACEHOLDER && cityParam.trim().length > 0;

    if (!trimmedQuery || !hasCity) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        const combinedQuery = `${cityParam} ${trimmedQuery}`.trim();
        const response = await fetch(`/api/search?q=${encodeURIComponent(combinedQuery)}`);
        const data = await response.json();
        const list: Restaurant[] = data.results || [];
        const filtered = list.filter((restaurant) => restaurantMatchesFilters(restaurant, ratingParam, priceParam));
        setResults(filtered);
      } catch {
        setResults([]);
      }
    };

    fetchResults();
  }, [searchParams]);

  const handleInputChange = (value: string) => {
    setSearchInput(value);
  };

  const handleCityChange = (value: string) => {
    setSelectedCity(value);
  };

  const handleRatingChange = (value: number) => {
    setRatingFilter(value);
  };

  const handlePriceChange = (value: string) => {
    setPriceFilter(value);
  };

  const handleSearchSubmit = ({ city, query, rating, price }: { city: string; query: string; rating: number; price: string }) => {
    const params = new URLSearchParams({
      city,
      q: query,
    });
    if (rating > 0) {
      params.set("rating", rating.toString());
    }
    if (price !== PRICE_PLACEHOLDER) {
      const tier = priceStringToTier(price);
      params.set("price", tier ? tier.toString() : price);
    }
    navigate(`/results?${params.toString()}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 relative overflow-hidden">
      {/* Floating food icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <Pizza className="size-16 absolute top-20 left-10 text-red-300 animate-bounce" style={{ animationDuration: '3s', animationDelay: '0s' }} />
        <Coffee className="size-14 absolute top-40 right-20 text-rose-400 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <IceCream className="size-16 absolute bottom-32 left-32 text-pink-300 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }} />
        <Cake className="size-14 absolute bottom-20 right-16 text-red-400 animate-bounce" style={{ animationDuration: '4.5s', animationDelay: '2s' }} />
        <Cookie className="size-12 absolute top-1/3 left-1/4 text-rose-300 animate-bounce" style={{ animationDuration: '5s', animationDelay: '1.5s' }} />
        <Croissant className="size-14 absolute top-1/2 right-1/3 text-pink-400 animate-bounce" style={{ animationDuration: '3.8s', animationDelay: '0.8s' }} />
        <Sandwich className="size-12 absolute bottom-1/3 left-1/3 text-red-300 animate-bounce" style={{ animationDuration: '4.2s', animationDelay: '1.2s' }} />
        <Cherry className="size-16 absolute top-1/4 right-1/4 text-rose-400 animate-bounce" style={{ animationDuration: '3.3s', animationDelay: '0.3s' }} />
      </div>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b-2 border-red-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <img src={dishcoveryLogo} alt="Dishcovery" className="size-14 cursor-pointer" onClick={() => navigate("/")} />
              <div>
                <h1 className="text-3xl text-gray-800">Dishcovery</h1>
                <p className="text-sm text-red-600">Discover what fits your mood</p>
              </div>
            </div>

            <SearchBar
              query={searchInput}
              onQueryChange={handleInputChange}
              city={selectedCity}
              onCityChange={handleCityChange}
              rating={ratingFilter}
              onRatingChange={handleRatingChange}
              price={priceFilter}
              onPriceChange={handlePriceChange}
              autoSubmitOnFilterChange
              onSubmit={handleSearchSubmit}
              placeholder="Search for restaurants, cuisines, or vibes..."
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Results */}
          <div>
            <div className="mb-6">
              <h2 className="text-lg text-gray-700">
                {activeQuery && activeCity !== CITY_PLACEHOLDER
                  ? `Found ${results.length} restaurant${results.length !== 1 ? "s" : ""} in ${activeCity} matching "${activeQuery}"${activeRating > 0 ? ` • ≥ ${activeRating.toFixed(1)}★` : ""}${activePrice !== PRICE_PLACEHOLDER ? ` • ${activePrice}` : ""}`
                  : `Showing ${results.length} restaurants`}
              </h2>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {results.map((restaurant) => (
                  <RestaurantCard key={restaurant.business_id} restaurant={restaurant} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border-2 border-red-100 shadow-sm">
                <div className="bg-gradient-to-br from-red-100 to-rose-100 size-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <UtensilsCrossed className="size-10 text-red-600" />
                </div>
                <h3 className="text-xl text-gray-700 mb-2">No restaurants found</h3>
                <p className="text-gray-500 mb-4">
                  Try adjusting your filters or search for something else
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-2 bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-full hover:shadow-lg transition-all"
                >
                  Start new search
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
