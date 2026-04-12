import { MapPin, Star, DollarSign, UtensilsCrossed, Clock } from "lucide-react";

export interface Restaurant {
  business_id: string;
  name: string;
  city: string;
  state?: string;
  matchScore?: number;
  cuisine?: string[];
  categories?: string | string[];
  rating?: number;
  stars?: number;
  priceRange?: string;
  priceTier?: number | null;
  ambience?: string[];
  hours?: Record<string, string> | null;
  matchExplanation?: string;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
}

const GENERIC_CATEGORIES = new Set([
  "Restaurants",
  "Nightlife",
  "Food",
  "Bars",
  "Desserts",
  "Vegetarian",
  "Event Planning & Services",
  "Arts & Entertainment",
  "Local Services",
  "Shopping",
  "Specialty Food",
  "Caterers",
  "Active Life",
  "Beauty & Spas",
  "Hotels & Travel",
]);

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  const categoriesList = Array.isArray(restaurant.categories)
    ? restaurant.categories
    : typeof restaurant.categories === "string"
      ? restaurant.categories.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  const cuisineCandidates = [
    ...(restaurant.cuisine ?? []),
    ...categoriesList,
  ];
  const primaryCuisine = cuisineCandidates.find((cat) => cat && !GENERIC_CATEGORIES.has(cat));
  const derivedTags =
    restaurant.ambience && restaurant.ambience.length > 0
      ? restaurant.ambience
      : categoriesList.slice(1, 4);

  const priceDisplay =
    restaurant.priceRange ??
    (restaurant.priceTier && restaurant.priceTier > 0 ? "$".repeat(restaurant.priceTier) : undefined);

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: userTimeZone }).format(new Date());

  const parseTime = (timeStr: string): string | null => {
    const [hourRaw, minuteRaw = "0"] = timeStr.split(":");
    const hourNum = Number(hourRaw);
    const minuteNum = Number(minuteRaw);
    if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) return null;
    const period = hourNum >= 12 ? "PM" : "AM";
    const hour12 = ((hourNum + 11) % 12) + 1;
    return `${hour12}:${minuteNum.toString().padStart(2, "0")} ${period}`;
  };

  const formatHoursForToday = (): string | null => {
    if (!restaurant.hours || typeof restaurant.hours !== "object") return null;
    const todayRange = restaurant.hours[todayLabel];
    if (!todayRange) return null;
    if (todayRange.toLowerCase() === "closed") return "Closed today";
    const [start, end] = todayRange.split("-");
    if (!start || !end) return null;
    if (start === "0:0" && end === "0:0") return "Closed today";
    const startFormatted = parseTime(start);
    const endFormatted = parseTime(end);
    if (!startFormatted || !endFormatted) return null;
    return `${startFormatted} – ${endFormatted}`;
  };

  const todayHours = formatHoursForToday();

  const ratingValue = restaurant.rating ?? restaurant.stars;
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(", ") || restaurant.city;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
      {/* Header: Restaurant Name + Match Score */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl text-gray-900">{restaurant.name}</h3>
        {restaurant.matchScore !== undefined && (
          <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-sm">
            {Math.round(restaurant.matchScore * 100)}% match
          </div>
        )}
      </div>

      {/* Match Explanation */}
      {restaurant.matchExplanation && (
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          {restaurant.matchExplanation}
        </p>
      )}

      {/* Metadata Row with Icons */}
      <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-600">
        {ratingValue !== undefined && (
          <div className="flex items-center gap-1.5">
            <Star className="size-4 text-yellow-500 fill-yellow-500" />
            <span>{ratingValue.toFixed(1)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4 text-gray-400" />
          <span>{location}</span>
        </div>
        {priceDisplay && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="size-4 text-gray-400" />
            <span>{priceDisplay}</span>
          </div>
        )}
        {primaryCuisine && (
          <div className="flex items-center gap-1.5">
            <UtensilsCrossed className="size-4 text-gray-400" />
            <span>{primaryCuisine}</span>
          </div>
        )}
        {todayHours && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 text-gray-400" />
            <span>{todayHours}</span>
          </div>
        )}
      </div>

      {/* Tags / Pills */}
      <div className="flex flex-wrap gap-2">
        {derivedTags.map((tag, index) => {
          const pillStyles = [
            "px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-sm",
            "px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-sm",
            "px-3 py-1 bg-pink-50 text-pink-700 border border-pink-200 rounded-full text-sm",
          ];
          const styleIndex = index % pillStyles.length;
          return (
            <span key={index} className={pillStyles[styleIndex]}>
              {tag}
            </span>
          );
        })}
      </div>
    </div>
  );
}
