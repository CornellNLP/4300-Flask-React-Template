/**
 * Maps search keywords to category strings or ambience keys from init.json. 
 */
const keywordMap: Record<string, string[]> = {
  // map created with limited help from Gen AI
  // ── American / comfort ────────────────────────────────────────────────────
  american:      ["American (Traditional)", "American (New)"],
  burger:        ["Burgers", "American (Traditional)", "American (New)"],
  burgers:       ["Burgers", "American (Traditional)", "American (New)"],
  cheesesteak:   ["Cheesesteaks"],
  cheesesteaks:  ["Cheesesteaks"],
  comfort:       ["Comfort Food"],
  diner:         ["Diners"],
  hotdog:        ["Hot Dogs"],
  hotdogs:       ["Hot Dogs"],
  southern:      ["Southern", "Soul Food"],
  soul:          ["Soul Food"],
  cajun:         ["Cajun/Creole"],
  creole:        ["Cajun/Creole"],
  smokehouse:    ["Smokehouse"],
  smoke:         ["Smokehouse"],
  texmex:        ["Tex-Mex"],

  // ── European ──────────────────────────────────────────────────────────────
  italian:       ["Italian"],
  pizza:         ["Pizza", "Italian"],
  pasta:         ["Pasta Shops", "Italian"],
  french:        ["French"],
  crepe:         ["Creperies"],
  crepes:        ["Creperies"],
  greek:         ["Greek"],
  spanish:       ["Spanish", "Tapas/Small Plates", "Tapas Bars"],
  tapas:         ["Tapas/Small Plates", "Tapas Bars", "Spanish"],
  german:        ["German"],
  british:       ["British"],
  irish:         ["Irish", "Irish Pub"],
  polish:        ["Polish"],
  portuguese:    ["Portuguese"],
  russian:       ["Russian"],
  scandinavian:  ["Scandinavian"],
  hungarian:     ["Hungarian"],
  belgian:       ["Belgian"],
  ukrainian:     ["Ukrainian"],
  basque:        ["Basque"],
  iberian:       ["Iberian"],

  // ── Asian ─────────────────────────────────────────────────────────────────
  asian:         ["Asian Fusion"],
  japanese:      ["Japanese", "Sushi Bars", "Ramen", "Izakaya"],
  sushi:         ["Sushi Bars", "Japanese"],
  ramen:         ["Ramen", "Japanese", "Noodles"],
  izakaya:       ["Izakaya"],
  chinese:       ["Chinese"],
  cantonese:     ["Cantonese"],
  szechuan:      ["Szechuan"],
  dim:           ["Dim Sum", "Chinese"],
  dimsum:        ["Dim Sum", "Chinese"],
  korean:        ["Korean"],
  thai:          ["Thai"],
  vietnamese:    ["Vietnamese"],
  pho:           ["Vietnamese"],
  indian:        ["Indian"],
  pakistani:     ["Pakistani"],
  bangladeshi:   ["Bangladeshi"],
  afghan:        ["Afghan"],
  malaysian:     ["Malaysian"],
  taiwanese:     ["Taiwanese"],
  filipino:      ["Filipino"],
  indonesian:    ["Indonesian"],
  singaporean:   ["Singaporean"],
  burmese:       ["Burmese"],
  cambodian:     ["Cambodian"],
  laotian:       ["Laotian"],
  mongolian:     ["Mongolian"],
  hotpot:        ["Hot Pot"],

  // ── Middle Eastern / African ──────────────────────────────────────────────
  middleeastern: ["Middle Eastern"],
  lebanese:      ["Lebanese"],
  arabic:        ["Arabic"],
  persian:       ["Persian/Iranian"],
  iranian:       ["Persian/Iranian"],
  turkish:       ["Turkish"],
  moroccan:      ["Moroccan"],
  falafel:       ["Falafel"],
  kebab:         ["Kebab"],
  halal:         ["Halal"],
  kosher:        ["Kosher"],
  ethiopian:     ["Ethiopian"],
  african:       ["African"],
  egyptian:      ["Egyptian"],
  senegalese:    ["Senegalese"],
  somali:        ["Somali"],

  // ── Latin American / Caribbean ────────────────────────────────────────────
  latin:         ["Latin American"],
  mexican:       ["Mexican"],
  taco:          ["Tacos", "Mexican"],
  tacos:         ["Tacos", "Mexican"],
  cuban:         ["Cuban"],
  caribbean:     ["Caribbean"],
  peruvian:      ["Peruvian"],
  brazilian:     ["Brazilian"],
  colombian:     ["Colombian"],
  argentine:     ["Argentine"],
  dominican:     ["Dominican"],
  salvadoran:    ["Salvadoran"],
  honduran:      ["Honduran"],
  haitian:       ["Haitian"],
  venezuelan:    ["Venezuelan"],
  trinidadian:   ["Trinidadian"],
  empanada:      ["Empanadas"],
  empanadas:     ["Empanadas"],

  // ── Mediterranean ─────────────────────────────────────────────────────────
  mediterranean: ["Mediterranean"],

  // ── Seafood ───────────────────────────────────────────────────────────────
  seafood:       ["Seafood"],
  fish:          ["Fish & Chips", "Seafood"],

  // ── Meat / grill ──────────────────────────────────────────────────────────
  steak:         ["Steakhouses"],
  steakhouse:    ["Steakhouses"],
  bbq:           ["Barbeque"],
  barbecue:      ["Barbeque"],
  wings:         ["Chicken Wings"],
  chicken:       ["Chicken Shop", "Chicken Wings"],

  // ── Sandwiches / wraps ────────────────────────────────────────────────────
  sandwich:      ["Sandwiches"],
  sandwiches:    ["Sandwiches"],
  deli:          ["Delicatessen", "Delis"],
  bagel:         ["Bagels"],
  bagels:        ["Bagels"],
  donair:        ["Donairs"],

  // ── Vegetarian / healthy / dietary ───────────────────────────────────────
  vegan:         ["Vegan"],
  vegetarian:    ["Vegetarian"],
  healthy:       ["Vegan", "Vegetarian", "Salad", "Juice Bars & Smoothies"],
  salad:         ["Salad"],
  soup:          ["Soup"],
  acai:          ["Acai Bowls"],
  juice:         ["Juice Bars & Smoothies"],
  smoothie:      ["Juice Bars & Smoothies"],
  glutenfree:    ["Gluten-Free"],
  poke:          ["Poke"],

  // ── Breakfast / brunch ────────────────────────────────────────────────────
  breakfast:     ["Breakfast & Brunch"],
  brunch:        ["Breakfast & Brunch"],
  pancakes:      ["Pancakes"],
  waffle:        ["Waffles"],
  waffles:       ["Waffles"],

  // ── Noodles ───────────────────────────────────────────────────────────────
  noodles:       ["Noodles", "Ramen"],

  // ── Coffee / tea / cafes ─────────────────────────────────────────────────
  coffee:        ["Coffee & Tea", "Cafes"],
  matcha:        ["Coffee & Tea", "Cafes", "Japanese"],
  tea:           ["Coffee & Tea", "Bubble Tea", "Tea Rooms"],
  boba:          ["Bubble Tea"],
  bubble:        ["Bubble Tea"],

  // ── Desserts / sweets ─────────────────────────────────────────────────────
  dessert:       ["Desserts", "Bakeries", "Ice Cream & Frozen Yogurt"],
  desserts:      ["Desserts", "Bakeries"],
  icecream:      ["Ice Cream & Frozen Yogurt"],
  gelato:        ["Gelato"],
  bakery:        ["Bakeries"],
  donut:         ["Donuts"],
  donuts:        ["Donuts"],
  cupcake:       ["Cupcakes"],
  cupcakes:      ["Cupcakes"],
  macaron:       ["Macarons"],
  macarons:      ["Macarons"],
  shavedice:     ["Shaved Ice"],
  chocolate:     ["Chocolatiers & Shops"],

  // ── Bars / nightlife ──────────────────────────────────────────────────────
  bar:           ["Bars", "Cocktail Bars"],
  cocktail:      ["Cocktail Bars"],
  cocktails:     ["Cocktail Bars"],
  wine:          ["Wine Bars", "Wine Tasting Room", "Wineries"],
  beer:          ["Beer Bar", "Beer Gardens", "Beer Hall", "Breweries", "Brewpubs"],
  brewery:       ["Breweries", "Brewpubs"],
  whiskey:       ["Whiskey Bars"],
  champagne:     ["Champagne Bars"],
  speakeasy:     ["Speakeasies"],
  tiki:          ["Tiki Bars"],
  hookah:        ["Hookah Bars"],
  lounge:        ["Lounges"],
  sports:        ["Sports Bars"],
  pub:           ["Gastropubs", "Pubs", "Irish Pub"],
  gastropub:     ["Gastropubs"],
  dive:          ["Dive Bars", "divey"],
  divey:         ["Dive Bars", "divey"],
  nightlife:     ["Bars", "Nightlife"],
  drinks:        ["Bars", "Cocktail Bars"],

  // ── Venue types ───────────────────────────────────────────────────────────
  bistro:        ["Bistros"],
  buffet:        ["Buffets"],
  fast:          ["Fast Food"],
  quick:         ["Fast Food", "Sandwiches"],
  foodtruck:     ["Food Trucks"],

  // ── Ambience / vibe ───────────────────────────────────────────────────────
  cozy:          ["casual", "Cafes", "Coffee & Tea"],
  romantic:      ["romantic", "Italian", "French"],
  casual:        ["casual"],
  trendy:        ["trendy"],
  upscale:       ["upscale", "classy"],
  fancy:         ["upscale", "classy"],
  classy:        ["classy", "upscale"],
  hipster:       ["hipster"],
  intimate:      ["intimate", "romantic"],
  quiet:         ["intimate"],
  touristy:      ["touristy"],
  cheap:         ["casual"],
  affordable:    ["casual"],
  spicy:         ["Thai", "Indian", "Mexican"],
  family:        ["casual"],
  lively:        ["trendy", "Bars"],
};

/**
 * Maps a search keyword to a phrase used in explanation
 * sentences
 */
const keywordLabel: Record<string, string> = {
  american:      "American food",
  burger:        "burgers",
  burgers:       "burgers",
  cheesesteak:   "cheesesteaks",
  cheesesteaks:  "cheesesteaks",
  comfort:       "comfort food",
  diner:         "diner food",
  hotdog:        "hot dogs",
  hotdogs:       "hot dogs",
  southern:      "Southern cuisine",
  soul:          "soul food",
  cajun:         "Cajun cuisine",
  creole:        "Creole cuisine",
  smokehouse:    "smokehouse",
  smoke:         "smokehouse",
  texmex:        "Tex-Mex",
  italian:       "Italian cuisine",
  pizza:         "pizza",
  pasta:         "pasta",
  french:        "French cuisine",
  crepe:         "crepes",
  crepes:        "crepes",
  greek:         "Greek cuisine",
  spanish:       "Spanish cuisine",
  tapas:         "tapas",
  german:        "German cuisine",
  british:       "British cuisine",
  irish:         "Irish food",
  polish:        "Polish cuisine",
  portuguese:    "Portuguese cuisine",
  russian:       "Russian cuisine",
  scandinavian:  "Scandinavian cuisine",
  hungarian:     "Hungarian cuisine",
  belgian:       "Belgian cuisine",
  ukrainian:     "Ukrainian cuisine",
  basque:        "Basque cuisine",
  iberian:       "Iberian cuisine",
  asian:         "Asian fusion",
  japanese:      "Japanese cuisine",
  sushi:         "sushi",
  ramen:         "ramen",
  izakaya:       "izakaya",
  chinese:       "Chinese cuisine",
  cantonese:     "Cantonese cuisine",
  szechuan:      "Szechuan cuisine",
  dim:           "dim sum",
  dimsum:        "dim sum",
  korean:        "Korean cuisine",
  thai:          "Thai cuisine",
  vietnamese:    "Vietnamese cuisine",
  pho:           "pho",
  indian:        "Indian cuisine",
  pakistani:     "Pakistani cuisine",
  bangladeshi:   "Bangladeshi cuisine",
  afghan:        "Afghan cuisine",
  malaysian:     "Malaysian cuisine",
  taiwanese:     "Taiwanese cuisine",
  filipino:      "Filipino cuisine",
  indonesian:    "Indonesian cuisine",
  singaporean:   "Singaporean cuisine",
  burmese:       "Burmese cuisine",
  cambodian:     "Cambodian cuisine",
  laotian:       "Laotian cuisine",
  mongolian:     "Mongolian cuisine",
  hotpot:        "hot pot",
  middleeastern: "Middle Eastern cuisine",
  lebanese:      "Lebanese cuisine",
  arabic:        "Arabic cuisine",
  persian:       "Persian cuisine",
  iranian:       "Persian cuisine",
  turkish:       "Turkish cuisine",
  moroccan:      "Moroccan cuisine",
  falafel:       "falafel",
  kebab:         "kebab",
  halal:         "halal food",
  kosher:        "kosher food",
  ethiopian:     "Ethiopian cuisine",
  african:       "African cuisine",
  egyptian:      "Egyptian cuisine",
  senegalese:    "Senegalese cuisine",
  somali:        "Somali cuisine",
  latin:         "Latin American cuisine",
  mexican:       "Mexican cuisine",
  taco:          "tacos",
  tacos:         "tacos",
  cuban:         "Cuban cuisine",
  caribbean:     "Caribbean cuisine",
  peruvian:      "Peruvian cuisine",
  brazilian:     "Brazilian cuisine",
  colombian:     "Colombian cuisine",
  argentine:     "Argentine cuisine",
  dominican:     "Dominican cuisine",
  salvadoran:    "Salvadoran cuisine",
  honduran:      "Honduran cuisine",
  haitian:       "Haitian cuisine",
  venezuelan:    "Venezuelan cuisine",
  trinidadian:   "Trinidadian cuisine",
  empanada:      "empanadas",
  empanadas:     "empanadas",
  mediterranean: "Mediterranean cuisine",
  seafood:       "seafood",
  fish:          "fish",
  steak:         "steakhouse dining",
  steakhouse:    "steakhouse dining",
  bbq:           "BBQ",
  barbecue:      "BBQ",
  wings:         "wings",
  chicken:       "chicken",
  sandwich:      "sandwiches",
  sandwiches:    "sandwiches",
  deli:          "deli",
  bagel:         "bagels",
  bagels:        "bagels",
  donair:        "donairs",
  vegan:         "vegan options",
  vegetarian:    "vegetarian options",
  healthy:       "healthy options",
  salad:         "salads",
  soup:          "soup",
  acai:          "acai bowls",
  juice:         "juice",
  smoothie:      "smoothies",
  glutenfree:    "gluten-free options",
  poke:          "poke",
  breakfast:     "breakfast",
  brunch:        "brunch",
  pancakes:      "pancakes",
  waffle:        "waffles",
  waffles:       "waffles",
  noodles:       "noodles",
  coffee:        "coffee",
  matcha:        "matcha",
  tea:           "tea",
  boba:          "boba",
  bubble:        "bubble tea",
  dessert:       "desserts",
  desserts:      "desserts",
  icecream:      "ice cream",
  gelato:        "gelato",
  bakery:        "baked goods",
  donut:         "donuts",
  donuts:        "donuts",
  cupcake:       "cupcakes",
  cupcakes:      "cupcakes",
  macaron:       "macarons",
  macarons:      "macarons",
  shavedice:     "shaved ice",
  chocolate:     "chocolate",
  bar:           "bar vibes",
  cocktail:      "cocktails",
  cocktails:     "cocktails",
  wine:          "wine",
  beer:          "beer",
  brewery:       "craft beer",
  whiskey:       "whiskey",
  champagne:     "champagne",
  speakeasy:     "a speakeasy vibe",
  tiki:          "tiki bar",
  hookah:        "hookah",
  lounge:        "lounge",
  sports:        "sports bar",
  pub:           "pub atmosphere",
  gastropub:     "gastropub dining",
  dive:          "a dive bar",
  divey:         "a dive bar",
  nightlife:     "nightlife",
  drinks:        "drinks",
  bistro:        "bistro",
  buffet:        "buffet",
  fast:          "quick service",
  quick:         "quick service",
  foodtruck:     "food truck",
  cozy:          "a cozy atmosphere",
  romantic:      "a romantic setting",
  casual:        "a casual atmosphere",
  trendy:        "a trendy vibe",
  upscale:       "upscale dining",
  fancy:         "upscale dining",
  classy:        "classy dining",
  hipster:       "a hipster vibe",
  intimate:      "an intimate setting",
  quiet:         "a quiet setting",
  touristy:      "a popular tourist spot",
  cheap:         "budget-friendly options",
  affordable:    "affordable prices",
  spicy:         "spicy food",
  family:        "family-friendly dining",
  lively:        "a lively atmosphere",
};

function ratingDescriptor(rating: number, threshold?: number): string | null {
  if (threshold && threshold > 0 && rating - threshold < 0.5) {
    return `rated above your ${threshold.toFixed(1)}★ threshold`;
  }
  if (rating >= 4.5) return "highly rated";
  if (rating >= 4.0) return "well-reviewed";
  return null;
}

function priceDescriptor(price: string): string | null {
  switch (price) {
    case "$":  return "at a very affordable price";
    case "$$": return "at a reasonable price";
    default:   return null;
  }
}

/**
 * Returns a short sentence explaining
 *
 * @param _name           Business name
 * @param tags            The business's tags w ambience labels and/or Yelp category strings
 * @param query           The user's raw search query string
 * @param rating          Star rating (0 if unknown)
 * @param price           Price tier string: "$", "$$", "$$$", "$$$$", or undefined
 * @param _score          Match percentage as a decimal
 * @param ratingThreshold The minimum star rating the user filtered by
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
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

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

  let core: string;
  if (matchedKeywords.length === 0) {
    const topTags = tags.slice(0, 2).join(" and ");
    core = topTags ? `Known for ${topTags}` : "A strong match";
  } else if (matchedKeywords.length === 1) {
    const label = keywordLabel[matchedKeywords[0]] ?? matchedKeywords[0];
    core = `Matches your search for ${label}`;
  } else {
    const labels = matchedKeywords.slice(0, 2).map((kw) => keywordLabel[kw] ?? kw);
    core = `Relevant for ${labels[0]} and ${labels[1]}`;
  }

  const ratingStr = rating > 0 ? ratingDescriptor(rating, ratingThreshold) : null;
  const priceStr = price ? priceDescriptor(price) : null;

  let suffix = "";
  if (ratingStr && priceStr) suffix = `, ${ratingStr} ${priceStr}`;
  else if (ratingStr) suffix = `, ${ratingStr}`;
  else if (priceStr) suffix = `, ${priceStr}`;

  return `${core}${suffix}.`;
}

/**
 * Returns subset of a tags that are directly relevant to the
 * query, used to highlight tag pills on the result card.
 */
export function getQueryAwareTags(tags: string[], query: string): string[] {
  if (!query.trim() || tags.length === 0) return [];

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
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
