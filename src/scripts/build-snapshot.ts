/**
 * Build a static JSON snapshot of a few periods straight from Wikimedia — no
 * database required. This lets the app run (and the 3D galleries fill with real
 * paintings) before Neon is wired up, and doubles as a smoke test of the whole
 * fetch pipeline.
 *
 *   npm run snapshot                          # default subset
 *   npm run snapshot -- impressionism baroque # specific period slugs
 *
 * Writes src/data/snapshot.json.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CURATED_PERIODS } from '../data/curated';
import { collectArtist, type CollectedArtist } from '../lib/collect';
import { sleep } from '../lib/wikimedia';

const DEFAULT_SUBSET = ['post-impressionism', 'impressionism', 'baroque'];

interface SnapshotPeriod {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  description: string;
  sortOrder: number;
  artists: (CollectedArtist & { sortOrder: number })[];
}

async function main() {
  const args = process.argv.slice(2).map((s) => s.toLowerCase());
  const slugs = args.length ? args : DEFAULT_SUBSET;
  const periods = CURATED_PERIODS.filter((p) => slugs.includes(p.slug));

  console.log(`\nBuilding snapshot for: ${slugs.join(', ')}\n`);
  const out: SnapshotPeriod[] = [];

  for (const period of periods) {
    console.log(`▸ ${period.name}`);
    const artists: (CollectedArtist & { sortOrder: number })[] = [];
    for (const [i, curated] of period.artists.entries()) {
      try {
        const data = await collectArtist(curated);
        if (data && data.artworks.length > 0) {
          artists.push({ ...data, sortOrder: i });
          console.log(`   ✓ ${data.name.padEnd(28)} ${data.artworks.length} works`);
        } else {
          console.log(`   ⚠  ${curated.title}: no usable artworks`);
        }
      } catch (err) {
        console.log(`   ⚠  ${curated.title}: ${(err as Error).message}`);
      }
      await sleep(180);
    }
    out.push({
      slug: period.slug,
      name: period.name,
      startYear: period.startYear,
      endYear: period.endYear,
      color: period.color,
      description: period.blurb,
      sortOrder: CURATED_PERIODS.findIndex((p) => p.slug === period.slug),
      artists,
    });
    console.log('');
  }

  const dir = dirname(fileURLToPath(import.meta.url));
  const dest = join(dir, '..', 'data', 'snapshot.json');
  await writeFile(dest, JSON.stringify({ periods: out }, null, 2));
  const totalWorks = out.reduce(
    (s, p) => s + p.artists.reduce((a, ar) => a + ar.artworks.length, 0),
    0,
  );
  console.log(`Wrote ${dest}\n${out.length} periods, ${totalWorks} artworks.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
