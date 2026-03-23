export interface Episode {
  title: string
  descr: string
  imdb_rating: number
}

export interface PlayerStats {
  name: string
  nationality: string | null
  position: string | null
  league: string
  team: string | null
  image: string | null
  goals: number | null
  assists: number | null
  appearances: number | null
  minutes: number | null
  shots_on_target: number | null
  dribbles_completed: number | null
  season_years: number[]
  seasons: string[]
  goals_per_game: number | null
  assists_per_game: number | null
  shot_on_target_ratio: number | null
  similarity_score?: number | null
  search_mode?: string | null
}
