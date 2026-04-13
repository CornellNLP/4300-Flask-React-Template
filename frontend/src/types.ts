export interface MenuItem {
  name: string;
  description: string;
  price: string;
}

export interface Restaurant {
  name: string;
  category: string;
  price_range: string;
  score: number;
  is_top_rated: boolean;
  ratings: string;
  address: string;
  similarity: number;
  matched_items: MenuItem[];
  popular_dish?: MenuItem;
  distance_miles?: number;
}

export interface SvdTerm {
  term: string;
  weight: number;
}

export interface SvdConcept {
  concept_id: number;
  activation: number;
  top_terms: SvdTerm[];
}

export interface SearchMeta {
  mode: string;
  concepts: SvdConcept[];
  error?: string;
}

export interface SearchResponse {
  results: Restaurant[];
  meta: SearchMeta;
}
