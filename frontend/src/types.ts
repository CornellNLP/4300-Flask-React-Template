export interface Song {
  title: string;
  artist: string;
  similarity: number;
  chords: Set<string>;
  guitar_difficulty: number;
  piano_difficulty: number;
}
