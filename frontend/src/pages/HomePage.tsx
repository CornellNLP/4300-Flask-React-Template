import { useState } from "react";
import { useNavigate } from "react-router";
import { SearchBar } from "../components/SearchBar";
import { Pizza, Coffee, IceCream, Cake, Cookie, Croissant, Sandwich, Cherry } from "lucide-react";
import dishcoveryLogo from "../assets/logo.png";

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("City");
  const [ratingFilter, setRatingFilter] = useState(0);
  const [priceFilter, setPriceFilter] = useState("Price");
  const navigate = useNavigate();

  const handleInputChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchSubmit = ({ city, query, rating, price }: { city: string; query: string; rating: number; price: string }) => {
    const params = new URLSearchParams({ city, q: query });
    if (rating > 0) params.set("rating", rating.toString());
    if (price !== "Price") params.set("price", price);
    navigate(`/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 relative overflow-hidden flex items-center justify-center">
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

      {/* Main content */}
      <div className="max-w-4xl w-full px-6 relative z-10">
        {/* Cute graphic and title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={dishcoveryLogo} alt="Dishcovery" className="size-40" />
          </div>

          <h1 className="text-7xl mb-4 text-white" style={{ fontFamily: 'Alfa Slab One, cursive', WebkitTextStroke: '0.5px #f43f5e', textShadow: '0 0 0 transparent' }}>Dishcovery</h1>
          <p className="text-xl text-red-600 mb-2">Discover what fits your mood</p>
          <p className="text-gray-500">Search by location, cuisine, mood, or what you're craving</p>
        </div>

        {/* Search bar */}
        <SearchBar
          query={searchQuery}
          onQueryChange={handleInputChange}
          city={selectedCity}
          onCityChange={setSelectedCity}
          rating={ratingFilter}
          onRatingChange={setRatingFilter}
          price={priceFilter}
          onPriceChange={setPriceFilter}
          onSubmit={handleSearchSubmit}
          placeholder="Try 'casual brunch' or 'latenight pizza'..."
        />
      </div>
    </div>
  );
}
