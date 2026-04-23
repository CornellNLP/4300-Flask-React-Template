export interface Episode {
  title: string;
  descr: string;
  imdb_rating: number;
}

export interface DimensionActivation {
  dimension: number;
  value: number;
  label: string;
}

export interface DimensionGroup {
  positive: DimensionActivation[];
}

export interface Episode {
  title: string;
  descr: string;
  imdb_rating: number;
}

export interface Podcast {
  title: string;
  description: string;
  explicit: boolean;
  image_url: string;
  feed_url: string;
  website_url: string;
  author: string;
  categories: string[];
  popularity_score: number;
  score?: number;
  popularity?: number;
  episode_count?: number;
  avg_episode_time?: number | string;
  top_dimensions?: DimensionGroup;
  why_you_love_it?: string;
}

export interface AiOverview {
  user_query: string;
  modified_query: string;
  explanation: string;
  used_context: boolean;
  low_score_fallback: boolean;
  context_top_k: number;
  score_threshold: number;
  top_scores: number[];
}

export interface CollabAiOverview extends AiOverview {
  user_query_a?: string;
  user_query_b?: string;
}

export interface PodcastsApiResponse {
  results: Podcast[];
  ai_overview?: AiOverview | null;
}

export interface MatchApiResponse {
  match_pct: number;
  results: Podcast[];
  ai_overview?: CollabAiOverview | null;
}

export interface SearchPayload {
  query: string;
  explicit: boolean;
  genres: string[];
  lengthMetric: "duration_ms" | "total_episodes";
  maxLength: number;
  publisher: string;
  releaseYear: string;
}

/* TODO: add more types as needed

Episode { 
  ...
}

*/
