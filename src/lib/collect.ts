/**
 * Shared "fetch one artist + their paintings from Wikimedia" routine, used by
 * both the Neon ingester (src/scripts/ingest.ts) and the no-DB snapshot builder
 * (src/scripts/build-snapshot.ts). Returns plain serialisable objects.
 */
import { type CuratedArtist } from '../data/curated';
import { slugify } from './slug';
import {
  fetchWikipediaSummary,
  fetchArtistFacts,
  fetchArtistArtworks,
  fetchCommonsImages,
  sleep,
} from './wikimedia';

export const MAX_ARTWORKS_PER_ARTIST = 12;

export interface CollectedArtwork {
  title: string;
  year: number | null;
  imageUrl: string;
  thumbUrl: string;
  widthPx: number;
  heightPx: number;
  medium: string | null;
  wikidataId: string;
  commonsUrl: string;
  credit: string | null;
}

export interface CollectedArtist {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  bio: string;
  thumbnailUrl: string | null;
  wikidataId: string;
  wikipediaUrl: string | null;
  fame: number;
  artworks: CollectedArtwork[];
}

export async function collectArtist(
  curated: CuratedArtist,
): Promise<CollectedArtist | null> {
  const display = curated.name ?? curated.title;
  const summary = await fetchWikipediaSummary(curated.title);
  if (!summary || !summary.qid) return null;

  const facts = await fetchArtistFacts(summary.qid);
  await sleep(120);

  const raw = await fetchArtistArtworks(summary.qid, 30);
  await sleep(120);
  const images = await fetchCommonsImages(raw.map((r) => r.fileTitle));

  const artworks: CollectedArtwork[] = raw
    .map((r) => {
      const img = images.get(r.fileTitle);
      if (!img || img.width < 400 || img.height < 400) return null;
      return { r, img, area: img.width * img.height };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x, i, arr) => arr.findIndex((y) => y.img.url === x.img.url) === i)
    // Most famous first (Wikipedia sitelink count), high-res as the tiebreaker.
    // Index 0 becomes the artist's "most popular" work — the hero piece.
    .sort((a, b) => b.r.sitelinks - a.r.sitelinks || b.area - a.area)
    .slice(0, MAX_ARTWORKS_PER_ARTIST)
    .filter((x) => x.r.qid)
    .map((x) => ({
      title: x.r.title,
      year: x.r.year,
      imageUrl: x.img.url,
      thumbUrl: x.img.thumbUrl,
      widthPx: x.img.width,
      heightPx: x.img.height,
      medium: x.r.medium,
      wikidataId: x.r.qid,
      commonsUrl: x.img.descUrl,
      credit: x.img.credit ?? display,
    }));

  return {
    slug: slugify(display),
    name: display,
    birthYear: facts.birthYear,
    deathYear: facts.deathYear,
    nationality: facts.nationality,
    bio: summary.extract,
    thumbnailUrl: summary.thumbnail,
    wikidataId: summary.qid,
    wikipediaUrl: summary.pageUrl,
    fame: curated.fame ?? 0.5,
    artworks,
  };
}
