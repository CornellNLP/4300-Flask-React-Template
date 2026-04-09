export interface Song {
  title: string;
  artist: string;
  similarity: number;
  cosine_score: number;
  svd_score: number;
  chords: string;
  guitar_difficulty: number;
  piano_difficulty: number;
}