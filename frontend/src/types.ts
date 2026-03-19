export interface SongRecommendation {
  id: string;
  spotify_url: string;
  title: string;
  artist: string;
  album: string;
  danceability: number;
  energy: number;
  valence: number;
  tempo: number;
  lyrics_preview: string;
  lyrics_full: string;
  tfidf_score: number;
}