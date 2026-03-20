// export interface Episode {
//   title: string;
//   descr: string;
//   imdb_rating: number;
// }

export interface Exercise {
  name: string;
  score: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  level: string | null;
  equipment: string | null;
  category: string | null;
  instructions: string[];
}
