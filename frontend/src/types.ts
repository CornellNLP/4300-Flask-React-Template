// export interface Episode {
//   title: string;
//   descr: string;
//   imdb_rating: number;
// }

export interface Exercise {
  title: string;
  desc: string | null | undefined;
  Type: string | null | undefined;
  BodyPart: string | null | undefined;
  Equipment: string | null | undefined;
  Level: string | null | undefined;
  Rating: string | null | undefined;
  RatingDesc: string | null | undefined;
}