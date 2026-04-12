import { useState } from "react";
import { useNavigate } from "react-router";
import { SearchBar } from "../components/SearchBar";
import dishcoveryLogo from "../assets/logo.png";

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

   const handleInputChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchSubmit = () => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/results?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 relative overflow-hidden flex items-center justify-center">
      {/* Main content */}
      <div className="max-w-3xl w-full px-6 relative z-10">
        {/* Cute graphic and title */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={dishcoveryLogo} alt="Dishcovery" className="size-40" />
          </div>
          
          <h1 className="text-6xl mb-4 text-gray-800">Dishcovery</h1>
          <p className="text-xl text-red-600 mb-2">Discover your next favorite restaurant</p>
          <p className="text-gray-500">Search by cuisine, mood, location, or what you're craving</p>
        </div>

        {/* Search bar */}
          <SearchBar
            value={searchQuery}
            onChange={handleInputChange}
            onSubmit={handleSearchSubmit}
            placeholder="Try 'Philadelphia casual ramen' or 'Nashville steak fancy'..."
          />
      </div>
    </div>
  );
}