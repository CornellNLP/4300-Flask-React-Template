export interface Recipe {
    name: string;
    description: string;
    minutes: number;
}

export interface Playlist {
    name: string;
    songs: string; // comma-separated string from the API
}