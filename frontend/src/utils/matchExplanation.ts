/**
 * Maps common search words to the Yelp category or ambience tag names
 * that a business might carry.
 */
const keywordMap: Record<string, string[]> = {
  // Cuisine types
  sushi: ["Sushi Bars", "Japanese"],
  ramen: ["Ramen", "Japanese", "Noodles"],
  pizza: ["Pizza", "Italian"],
  burger: ["Burgers", "American (Traditional)", "American (New)"],
  burgers: ["Burgers", "American (Traditional)", "American (New)"],
  taco: ["Mexican", "Tacos"],
  tacos: ["Mexican", "Tacos"],
  mexican: ["Mexican"],
  italian: ["Italian"],
  chinese: ["Chinese"],
  thai: ["Thai"],
  indian: ["Indian"],
  korean: ["Korean"],
  vietnamese: ["Vietnamese"],
  mediterranean: ["Mediterranean"],
  greek: ["Greek"],
  french: ["French"],
  american: ["American (Traditional)", "American (New)"],
  seafood: ["Seafood"],
  steak: ["Steakhouses"],
  steakhouse: ["Steakhouses"],
  bbq: ["Barbeque"],
  barbecue: ["Barbeque"],
  vegan: ["Vegan"],
  vegetarian: ["Vegetarian"],
  breakfast: ["Breakfast & Brunch"],
  brunch: ["Breakfast & Brunch"],
  coffee: ["Coffee & Tea", "Cafes"],
  matcha: ["Coffee & Tea", "Cafes", "Japanese"],
  tea: ["Coffee & Tea", "Bubble Tea"],
  boba: ["Bubble Tea"],
  bubble: ["Bubble Tea"],
  dessert: ["Desserts", "Bakeries", "Ice Cream & Frozen Yogurt"],
  desserts: ["Desserts", "Bakeries"],
  icecream: ["Ice Cream & Frozen Yogurt"],
  bakery: ["Bakeries"],
  sandwich: ["Sandwiches"],
  sandwiches: ["Sandwiches"],
  salad: ["Salad"],
  soup: ["Soup"],
  noodles: ["Noodles", "Ramen"],
  pho: ["Vietnamese"],
  wings: ["Chicken Wings"],
  halal: ["Halal"],
  tapas: ["Tapas/Small Plates", "Spanish"],
  bar: ["Bars", "Cocktail Bars"],
  cocktail: ["Cocktail Bars"],
  cocktails: ["Cocktail Bars"],
  sports: ["Sports Bars"],
  pub: ["Gastropubs", "Pubs"],
  gastropub: ["Gastropubs"],
  fast: ["Fast Food"],
  quick: ["Fast Food", "Sandwiches"],
  dim: ["Dim Sum", "Chinese"],
  dimsum: ["Dim Sum", "Chinese"],
  // Ambience / vibe
  cozy: ["casual", "Cafes", "Coffee & Tea"],
  romantic: ["romantic", "Italian", "French"],
  casual: ["casual"],
  trendy: ["trendy"],
  upscale: ["upscale", "classy"],
  fancy: ["upscale", "classy"],
  classy: ["classy", "upscale"],
  hipster: ["hipster"],
  intimate: ["intimate", "romantic"],
  quiet: ["intimate"],
  cheap: ["casual"],
  affordable: ["casual"],
  healthy: ["Vegan", "Vegetarian", "Salad"],
  spicy: ["Thai", "Indian", "Mexican"],
  family: ["casual"],
  lively: ["trendy", "Bars"],
  nightlife: ["Bars", "Nightlife"],
  drinks: ["Bars", "Cocktail Bars"],
  dive: ["divey"],
  divey: ["divey"],
};

/**
 * Maps a search keyword to a readable display phrase used in explanation sentences.
 */
const keywordLabel: Record<string, string> = {
  sushi: "sushi",
  ramen: "ramen",
  pizza: "pizza",
  burger: "burgers",
  burgers: "burgers",
  taco: "tacos",
  tacos: "tacos",
  mexican: "Mexican cuisine",
  italian: "Italian cuisine",
  chinese: "Chinese cuisine",
  thai: "Thai cuisine",
  indian: "Indian cuisine",
  korean: "Korean cuisine",
  vietnamese: "Vietnamese cuisine",
  mediterranean: "Mediterranean cuisine",
  greek: "Greek cuisine",
  french: "French cuisine",
  american: "American food",
  seafood: "seafood",
  steak: "steakhouse dining",
  steakhouse: "steakhouse dining",
  bbq: "BBQ",
  barbecue: "BBQ",
  vegan: "vegan options",
  vegetarian: "vegetarian options",
  breakfast: "breakfast",
  brunch: "brunch",
  coffee: "coffee",
  matcha: "matcha",
  tea: "tea",
  boba: "boba",
  bubble: "bubble tea",
  dessert: "desserts",
  desserts: "desserts",
  icecream: "ice cream",
  bakery: "baked goods",
  sandwich: "sandwiches",
  sandwiches: "sandwiches",
  salad: "salads",
  soup: "soup",
  noodles: "noodles",
  pho: "pho",
  wings: "wings",
  halal: "halal food",
  tapas: "tapas",
  bar: "bar vibes",
  cocktail: "cocktails",
  cocktails: "cocktails",
  sports: "sports bar",
  pub: "pub atmosphere",
  gastropub: "gastropub dining",
  fast: "quick service",
  quick: "quick service",
  dim: "dim sum",
  dimsum: "dim sum",
  cozy: "a cozy atmosphere",
  romantic: "a romantic setting",
  casual: "a casual atmosphere",
  trendy: "a trendy vibe",
  upscale: "upscale dining",
  fancy: "upscale dining",
  classy: "classy dining",
  hipster: "a hipster vibe",
  intimate: "an intimate setting",
  quiet: "a quiet setting",
  cheap: "budget-friendly options",
  affordable: "affordable prices",
  healthy: "healthy options",
  spicy: "spicy food",
  family: "family-friendly dining",
  lively: "a lively atmosphere",
  nightlife: "nightlife",
  drinks: "drinks",
  dive: "a dive bar feel",
  divey: "a dive bar feel",
};

function ratingDescriptor(rating: number, threshold?: number): string | null {
  // If a filter threshold is set and the rating barely clears it, be factual rather than flattering
  if (threshold && threshold > 0 && rating - threshold < 0.5) {
    return `rated above your ${threshold.toFixed(1)}★ threshold`;
  }
  if (rating >= 4.5) return "highly rated";
  if (rating >= 4.0) return "well-reviewed";
  // Below 4.0 — not worth adding a positive spin
  return null;
}

function priceDescriptor(price: string): string | null {
  switch (price) {
    case "$":  return "at a very affordable price";
    case "$$": return "at a reasonable price";
    // $$$ / $$$$ — the dollar signs already communicate cost; don't dress it up
    default:   return null;
  }
}

/**
 * Returns a short plain-English sentence explaining why a business appeared in
 * results for the given query.
 *
 * @param name            Business name (unused in sentence body but available for future use)
 * @param tags            The business's tags — ambience labels and/or Yelp category strings
 * @param query           The user's raw search query string
 * @param rating          Star rating (0 if unknown)
 * @param price           Price tier string: "$", "$$", "$$$", "$$$$", or undefined
 * @param score           Match percentage as a decimal (e.g. 0.78 = 78 %)
 * @param ratingThreshold The minimum star rating the user filtered by (0 or omitted = no filter)
 */
export function generateMatchExplanation(
  _name: string,
  tags: string[],
  query: string,
  rating: number,
  price: string | undefined,
  _score: number,
  ratingThreshold?: number,
): string {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  // Find which query words have mapped categories that overlap the business's tags
  const matchedKeywords: string[] = [];
  for (const word of words) {
    const mappedCategories = keywordMap[word];
    if (!mappedCategories) continue;

    const hasOverlap = mappedCategories.some(
      (cat) =>
        tagSet.has(cat.toLowerCase()) ||
        tags.some(
          (tag) =>
            tag.toLowerCase().includes(cat.toLowerCase()) ||
            cat.toLowerCase().includes(tag.toLowerCase()),
        ),
    );

    if (hasOverlap && !matchedKeywords.includes(word)) {
      matchedKeywords.push(word);
    }
  }

  // Build core sentence
  let core: string;
  if (matchedKeywords.length === 0) {
    // Fallback: list the business's first two non-trivial tags
    const topTags = tags.slice(0, 2).join(" and ");
    core = topTags ? `Known for ${topTags}` : "A strong match";
  } else if (matchedKeywords.length === 1) {
    const label = keywordLabel[matchedKeywords[0]] ?? matchedKeywords[0];
    core = `Matches your search for ${label}`;
  } else {
    const labels = matchedKeywords
      .slice(0, 2)
      .map((kw) => keywordLabel[kw] ?? kw);
    core = `Relevant for ${labels[0]} and ${labels[1]}`;
  }

  // Build suffix: rating descriptor + price descriptor
  const ratingStr = rating > 0 ? ratingDescriptor(rating, ratingThreshold) : null;
  const priceStr = price ? priceDescriptor(price) : null;

  let suffix = "";
  if (ratingStr && priceStr) {
    suffix = `, ${ratingStr} ${priceStr}`;
  } else if (ratingStr) {
    suffix = `, ${ratingStr}`;
  } else if (priceStr) {
    suffix = `, ${priceStr}`;
  }

  return `${core}${suffix}.`;
}

/**
 * Returns the subset of a business's tags that are directly relevant to the
 * query. Used to refine the tag pills shown on each result card.
 *
 * Returns an empty array when no query words map to any of the business's tags
 * (caller should fall back to its default tag-display logic in that case).
 */
export function getQueryAwareTags(tags: string[], query: string): string[] {
  if (!query.trim() || tags.length === 0) return [];

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const relevantCategories = new Set<string>();
  for (const word of words) {
    const mapped = keywordMap[word];
    if (mapped) mapped.forEach((cat) => relevantCategories.add(cat.toLowerCase()));
  }

  if (relevantCategories.size === 0) return [];

  return tags.filter((tag) =>
    [...relevantCategories].some(
      (cat) =>
        tag.toLowerCase().includes(cat) || cat.includes(tag.toLowerCase()),
    ),
  );
}
