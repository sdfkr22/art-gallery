/**
 * Ingestion pipeline: curated periods/artists  ->  live Wikimedia data  ->  Neon.
 *
 *   npm run ingest                 # ingest everything
 *   npm run ingest -- impressionism post-impressionism   # only these period slugs
 *
 * For every curated artist we:
 *   1. resolve their Wikipedia summary (bio, portrait, Wikidata QID)
 *   2. read birth/death/nationality from Wikidata
 *   3. list their paintings (creator + image) from Wikidata
 *   4. resolve each painting's real image URL + pixel size + credit from Commons
 * ...then upsert periods -> artists -> artworks into Postgres.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { CURATED_PERIODS, type CuratedArtist } from '../data/curated';
import { collectArtist } from '../lib/collect';
import { sleep } from '../lib/wikimedia';

if (!process.env.DATABASE_URL) {
  console.error('\n✖ DATABASE_URL is not set. Create .env.local with your Neon URL.\n');
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL), { schema });

async function ingestArtist(
  periodId: number,
  curated: CuratedArtist,
  index: number,
): Promise<number> {
  const display = curated.name ?? curated.title;
  const data = await collectArtist(curated);
  if (!data) {
    console.warn(`   ⚠  ${display}: no Wikipedia/Wikidata match, skipping`);
    return 0;
  }

  const [artistRow] = await db
    .insert(schema.artists)
    .values({
      periodId,
      slug: data.slug,
      name: data.name,
      birthYear: data.birthYear,
      deathYear: data.deathYear,
      nationality: data.nationality,
      bio: data.bio,
      thumbnailUrl: data.thumbnailUrl,
      wikidataId: data.wikidataId,
      wikipediaUrl: data.wikipediaUrl,
      fame: data.fame,
      sortOrder: index,
    })
    .onConflictDoUpdate({
      target: schema.artists.slug,
      set: {
        periodId,
        name: data.name,
        birthYear: data.birthYear,
        deathYear: data.deathYear,
        nationality: data.nationality,
        bio: data.bio,
        thumbnailUrl: data.thumbnailUrl,
        wikidataId: data.wikidataId,
        wikipediaUrl: data.wikipediaUrl,
        fame: data.fame,
        sortOrder: index,
      },
    })
    .returning({ id: schema.artists.id });

  const artistId = artistRow.id;

  // Replace this artist's works wholesale so a re-ingest can't leave stale
  // (e.g. previously size-ranked) paintings behind alongside the new set.
  await db.delete(schema.artworks).where(eq(schema.artworks.artistId, artistId));

  for (const [i, art] of data.artworks.entries()) {
    await db
      .insert(schema.artworks)
      .values({ artistId, sortOrder: i, ...art })
      .onConflictDoUpdate({
        target: schema.artworks.wikidataId,
        set: { artistId, sortOrder: i, ...art },
      });
  }

  console.log(
    `   ✓ ${display.padEnd(28)} ${data.artworks.length} works  (${data.birthYear ?? '?'}–${data.deathYear ?? '?'})`,
  );
  return data.artworks.length;
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const periods = only.length
    ? CURATED_PERIODS.filter((p) => only.includes(p.slug))
    : CURATED_PERIODS;

  console.log(`\nIngesting ${periods.length} period(s) into Neon…\n`);
  let totalWorks = 0;

  for (const [pIndex, period] of periods.entries()) {
    const [periodRow] = await db
      .insert(schema.periods)
      .values({
        slug: period.slug,
        name: period.name,
        startYear: period.startYear,
        endYear: period.endYear,
        description: period.blurb,
        color: period.color,
        sortOrder: CURATED_PERIODS.findIndex((p) => p.slug === period.slug),
      })
      .onConflictDoUpdate({
        target: schema.periods.slug,
        set: {
          name: period.name,
          startYear: period.startYear,
          endYear: period.endYear,
          description: period.blurb,
          color: period.color,
          sortOrder: CURATED_PERIODS.findIndex((p) => p.slug === period.slug),
        },
      })
      .returning({ id: schema.periods.id });

    console.log(`▸ ${period.name}  (${period.startYear}–${period.endYear})`);
    for (const [i, artist] of period.artists.entries()) {
      try {
        totalWorks += await ingestArtist(periodRow.id, artist, i);
      } catch (err) {
        console.warn(`   ⚠  ${artist.title}: ${(err as Error).message}`);
      }
      await sleep(180);
    }
    console.log('');
  }

  console.log(`Done. ${totalWorks} artworks ingested.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
