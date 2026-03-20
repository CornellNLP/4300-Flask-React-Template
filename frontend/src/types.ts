export interface ScoreBreakdown {
  text_score: number
  climate_score: number
  relative_temp_score: number
  activity_score: number
  budget_score: number
  distance_score: number
}

export interface Destination {
  city: string
  country: string
  region: string
  budget: string
  score: number
  scores: ScoreBreakdown
  short_description: string
}

export interface SearchResponse {
  query: string
  user_nearest_city?: string
  user_baseline_temp_c?: number
  results: Destination[]
}

export interface Destination {
  city: string
  country: string
  region: string
  budget: string
  score: number
  text_similarity: number    // ← NEW
  scores: ScoreBreakdown
  short_description: string
}