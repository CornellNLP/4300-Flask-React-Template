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
  avg_episode_time?: number;
}

/* TODO: add more types as needed

Episode { 
  ...
}

*/
