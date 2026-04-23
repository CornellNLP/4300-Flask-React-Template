export interface Recipe {
  name: string;
  description: string;
  minutes: number;
  ingredients: string;
  link: string;
  // SVD fields — optional since endpoint may fall back to plain results
  similarity?: number;
  query_dims?: DimInfo[];
  doc_dims?: DimInfo[];
  shared_dims?: DimInfo[];
  highlighted_keywords?: string[];
  doc_magnitudes?: number[];
  query_magnitudes?: number[];
}

export interface Recommendation {
  title: string;
  author: string;
}

export interface PlaylistRecommendations {
  recommendations: Recommendation[];
  explanation: string;
}

export interface Playlist {
  name: string;
  songs: string;
  artist: string;
}

export interface DimInfo {
  dim: number;
  name: string;
  magnitude: number;
  keywords: string[];
}

export interface SVDRecipe {
  name: string;
  description: string;
  minutes: number;
  ingredients: string;
  link: string;
  similarity: number;
  query_dims: DimInfo[];
  doc_dims: DimInfo[];
  shared_dims: DimInfo[];
  highlighted_keywords: string[];
  doc_magnitudes: number[];
  query_magnitudes: number[];
}
