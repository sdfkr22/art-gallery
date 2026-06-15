/**
 * Data-access layer. Reads from Neon when DATABASE_URL is set, otherwise falls
 * back to the bundled JSON snapshot so the app always renders something.
 * Both paths return the same DTO shapes (src/lib/types.ts).
 */
import { eq, asc, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { periods, artists, artworks } from '../db/schema';
import type { ArtistWithContext, PeriodDTO, ArtworkDTO } from './types';
import snapshot from '../data/snapshot.json';

/* ------------------------------- Snapshot -------------------------------- */

type SnapArtwork = {
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
};
type SnapArtist = {
  slug: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
  bio: string;
  thumbnailUrl: string | null;
  wikipediaUrl: string | null;
  fame: number;
  artworks: SnapArtwork[];
};
type SnapPeriod = {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  description: string;
  artists: SnapArtist[];
};

const snap = snapshot as { periods: SnapPeriod[] };

function snapArtworkToDTO(a: SnapArtwork): ArtworkDTO {
  return {
    key: a.wikidataId,
    title: a.title,
    year: a.year,
    imageUrl: a.imageUrl,
    thumbUrl: a.thumbUrl,
    widthPx: a.widthPx,
    heightPx: a.heightPx,
    medium: a.medium,
    commonsUrl: a.commonsUrl,
    credit: a.credit,
  };
}

function snapTimeline(): PeriodDTO[] {
  return snap.periods
    .slice()
    .sort((a, b) => a.startYear - b.startYear)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      startYear: p.startYear,
      endYear: p.endYear,
      color: p.color,
      description: p.description,
      artists: p.artists
        .slice()
        .sort((a, b) => b.fame - a.fame)
        .map((a) => ({
          slug: a.slug,
          name: a.name,
          birthYear: a.birthYear,
          deathYear: a.deathYear,
          nationality: a.nationality,
          bio: a.bio,
          thumbnailUrl: a.thumbnailUrl,
          wikipediaUrl: a.wikipediaUrl,
          fame: a.fame,
          artworkCount: a.artworks.length,
        })),
    }));
}

function snapArtist(slug: string): ArtistWithContext | null {
  for (const p of snap.periods) {
    const a = p.artists.find((x) => x.slug === slug);
    if (a) {
      return {
        slug: a.slug,
        name: a.name,
        birthYear: a.birthYear,
        deathYear: a.deathYear,
        nationality: a.nationality,
        bio: a.bio,
        thumbnailUrl: a.thumbnailUrl,
        wikipediaUrl: a.wikipediaUrl,
        fame: a.fame,
        artworkCount: a.artworks.length,
        artworks: a.artworks.map(snapArtworkToDTO),
        period: {
          slug: p.slug,
          name: p.name,
          color: p.color,
          startYear: p.startYear,
          endYear: p.endYear,
        },
      };
    }
  }
  return null;
}

/* --------------------------------- Public -------------------------------- */

export async function getTimeline(): Promise<PeriodDTO[]> {
  if (!db) return snapTimeline();

  const [periodRows, artistRows, counts] = await Promise.all([
    db.select().from(periods).orderBy(asc(periods.startYear)),
    db.select().from(artists).orderBy(desc(artists.fame)),
    db
      .select({
        artistId: artworks.artistId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(artworks)
      .groupBy(artworks.artistId),
  ]);

  const countByArtist = new Map(counts.map((c) => [c.artistId, c.count]));

  return periodRows.map((p) => ({
    slug: p.slug,
    name: p.name,
    startYear: p.startYear,
    endYear: p.endYear,
    color: p.color,
    description: p.description,
    artists: artistRows
      .filter((a) => a.periodId === p.id)
      .map((a) => ({
        slug: a.slug,
        name: a.name,
        birthYear: a.birthYear,
        deathYear: a.deathYear,
        nationality: a.nationality,
        bio: a.bio,
        thumbnailUrl: a.thumbnailUrl,
        wikipediaUrl: a.wikipediaUrl,
        fame: a.fame,
        artworkCount: countByArtist.get(a.id) ?? 0,
      })),
  }));
}

export async function getArtist(slug: string): Promise<ArtistWithContext | null> {
  if (!db) return snapArtist(slug);

  const [artist] = await db
    .select()
    .from(artists)
    .where(eq(artists.slug, slug))
    .limit(1);
  if (!artist) return null;

  const [period] = await db
    .select()
    .from(periods)
    .where(eq(periods.id, artist.periodId))
    .limit(1);

  const works = await db
    .select()
    .from(artworks)
    .where(eq(artworks.artistId, artist.id))
    .orderBy(asc(artworks.sortOrder));

  return {
    slug: artist.slug,
    name: artist.name,
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
    nationality: artist.nationality,
    bio: artist.bio,
    thumbnailUrl: artist.thumbnailUrl,
    wikipediaUrl: artist.wikipediaUrl,
    fame: artist.fame,
    artworkCount: works.length,
    artworks: works.map((w) => ({
      key: w.wikidataId ?? String(w.id),
      title: w.title,
      year: w.year,
      imageUrl: w.imageUrl,
      thumbUrl: w.thumbUrl ?? w.imageUrl,
      widthPx: w.widthPx ?? 1000,
      heightPx: w.heightPx ?? 1000,
      medium: w.medium,
      commonsUrl: w.commonsUrl,
      credit: w.credit,
    })),
    period: {
      slug: period.slug,
      name: period.name,
      color: period.color,
      startYear: period.startYear,
      endYear: period.endYear,
    },
  };
}
