import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { RestaurantCard, type Restaurant } from "../components/RestaurantCard";
import { ArrowLeft } from "lucide-react";
import dishcoveryLogo from "../assets/logo.png";

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [results, setResults] = useState<Restaurant[]>([]);


  // Update search query when URL changes
  useEffect(() => {
    const queryParam = searchParams.get("q") || "";
    setSearchInput(queryParam);
    setActiveQuery(queryParam);

    if (!queryParam.trim()) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(queryParam)}`);
        const data = await response.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      }
    };

    fetchResults();
  }, [searchParams]);

  const handleInputChange = (value: string) => {
    setSearchInput(value);
  };

  const handleSearchSubmit = () => {
    const trimmed = searchInput.trim();
    if (trimmed) {
      navigate(`/results?q=${encodeURIComponent(trimmed)}`, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b-2 border-red-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-red-100 rounded-full transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="size-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <img src={dishcoveryLogo} alt="Dishcovery" className="size-14" />
              <div>
                <h1 className="text-3xl text-gray-800">Dishcovery</h1>
                <p className="text-sm text-red-600">Discover your next favorite restaurant</p>
              </div>
            </div>
          </div>

          <SearchBar
            value={searchInput}
            onChange={handleInputChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search for restaurants, cuisines, or vibes..."
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Results */}
          <div>
            <div className="mb-6">
              <h2 className="text-lg text-gray-700">
                {activeQuery
                  ? `Found ${results.length} restaurant${results.length !== 1 ? "s" : ""} matching "${activeQuery}"`
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
                  <img src={dishcoveryLogo} alt="Dishcovery" className="size-20" />
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