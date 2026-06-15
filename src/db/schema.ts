import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Art periods / movements. These are the top-level nodes on the timeline.
 * `startYear` may be negative for BCE (e.g. Ancient art).
 */
export const periods = pgTable(
  'periods',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    startYear: integer('start_year').notNull(),
    endYear: integer('end_year').notNull(),
    description: text('description').notNull().default(''),
    /** Accent color used on the timeline + gallery theming, hex string. */
    color: text('color').notNull().default('#b08d57'),
    wikidataId: text('wikidata_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('periods_slug_idx').on(t.slug),
  }),
);

/** Famous artists, each belonging to one period. */
export const artists = pgTable(
  'artists',
  {
    id: serial('id').primaryKey(),
    periodId: integer('period_id')
      .notNull()
      .references(() => periods.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    birthYear: integer('birth_year'),
    deathYear: integer('death_year'),
    nationality: text('nationality'),
    /** Short biography / placard text, sourced from the Wikipedia REST summary. */
    bio: text('bio').notNull().default(''),
    /** Portrait thumbnail (Commons). */
    thumbnailUrl: text('thumbnail_url'),
    wikidataId: text('wikidata_id'),
    wikipediaUrl: text('wikipedia_url'),
    /** How prominent the artist is, used to order/feature them. Higher = more famous. */
    fame: real('fame').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: uniqueIndex('artists_slug_idx').on(t.slug),
    periodIdx: index('artists_period_idx').on(t.periodId),
    wikidataIdx: index('artists_wikidata_idx').on(t.wikidataId),
  }),
);

/** Individual paintings hung in an artist's gallery room. */
export const artworks = pgTable(
  'artworks',
  {
    id: serial('id').primaryKey(),
    artistId: integer('artist_id')
      .notNull()
      .references(() => artists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    year: integer('year'),
    /** Full-resolution Commons image used as the painting texture. */
    imageUrl: text('image_url').notNull(),
    /** Smaller thumbnail for fast lists / previews. */
    thumbUrl: text('thumb_url'),
    /** Native pixel dimensions, used to compute the canvas aspect ratio in 3D. */
    widthPx: integer('width_px'),
    heightPx: integer('height_px'),
    medium: text('medium'),
    wikidataId: text('wikidata_id'),
    commonsUrl: text('commons_url'),
    /** Attribution line for the placard (artist + source). */
    credit: text('credit'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    artistIdx: index('artworks_artist_idx').on(t.artistId),
    wikidataIdx: uniqueIndex('artworks_wikidata_idx').on(t.wikidataId),
  }),
);

export type Period = typeof periods.$inferSelect;
export type Artist = typeof artists.$inferSelect;
export type Artwork = typeof artworks.$inferSelect;
