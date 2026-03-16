export interface Episode {
  title: string
  descr: string
  imdb_rating: number
}

export interface PlayerStats {
  league: string
  name: string
  team: string | null
  position: string | null
  image: string | null
  games: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  shots: number | null
  shots_on_target: number | null
  touches_in_box: number | null
}
