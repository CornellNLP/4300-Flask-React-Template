export interface Song {
  title: string;
  artist: string;
  chords: Set<string>;
  guitar_difficulty: number;
  piano_difficulty: number;
}
