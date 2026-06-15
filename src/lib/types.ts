/** Shapes returned by the data layer / API to the client. Keyed by slug. */

export interface ArtworkDTO {
  key: string; // wikidataId (stable React key)
  title: string;
  year: number | null;
  imageUrl: string;
  thumbUrl: string;
  widthPx: number;
  heightPx: number;
  medium: string | null;
  commonsUrl: string | null;
  credit: string | null;
}

export interface ArtistDTO {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  bio: string;
  thumbnailUrl: string | null;
  wikipediaUrl: string | null;
  fame: number;
  artworkCount: number;
  /** Present only when fetched for a single artist's gallery. */
  artworks?: ArtworkDTO[];
}

export interface PeriodDTO {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  description: string;
  artists: ArtistDTO[];
}

/** An artist plus the period it belongs to (for the gallery view). */
export interface ArtistWithContext extends ArtistDTO {
  artworks: ArtworkDTO[];
  period: Pick<PeriodDTO, 'slug' | 'name' | 'color' | 'startYear' | 'endYear'>;
}
