# The Infinite Gallery — a 3D museum of art history

An interactive, browser-based museum. Pan and zoom an **infinite timeline** of
eight centuries of art; zoom into a movement and its masters appear; click an
artist for a **museum placard** and a **realistic 3D gallery** of their
paintings you can walk through.

All artwork data is pulled from the **Wikipedia REST API + Wikidata + Wikimedia
Commons** and stored in **Neon Postgres**. Animations use **GSAP**; the 3D
galleries are built with **React Three Fiber** with ACES filmic tone mapping,
soft shadows, per-painting spotlights, a reflective stone floor and a
bloom / vignette post-processing pipeline.

```
Timeline (semantic-zoom canvas, GSAP)  ──click artist──▶  3D Gallery (R3F)
        │                                                      │
   /api/timeline                                        /api/artists/[slug]
        └──────────────  src/lib/queries  ──────────────────┘
                     Neon Postgres  ·OR·  bundled JSON snapshot
```

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Out of the box the app runs on a **bundled snapshot** of real Commons data
(`src/data/snapshot.json`), so the galleries are populated immediately — no
database required.

## Going live with Neon

1. Create a project at <https://console.neon.tech> and copy the pooled
   connection string.
2. Save it:

   ```bash
   cp .env.example .env.local
   # then edit .env.local and paste your DATABASE_URL
   ```

3. Create the tables and ingest the full catalogue from Wikimedia:

   ```bash
   npm run db:push       # creates periods / artists / artworks tables
   npm run ingest        # pulls every curated period from Wikipedia + Wikidata + Commons
   # or a subset:
   npm run ingest -- impressionism baroque
   ```

Once `DATABASE_URL` is set, every request reads from Neon automatically
(`src/db/index.ts` → `hasDatabase`). Without it, the snapshot is served.

## Scripts

| command                | what it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | start the app                                                       |
| `npm run build`        | production build                                                    |
| `npm run db:push`      | push the Drizzle schema to Neon                                     |
| `npm run db:studio`    | browse the database in Drizzle Studio                               |
| `npm run ingest`       | ingest curated periods → Neon (optionally pass period slugs)        |
| `npm run snapshot`     | rebuild the no-DB JSON snapshot from live APIs (optional slug args) |

## How the data is sourced

The editorial catalogue (which periods exist, which artists belong to each)
lives in [`src/data/curated.ts`](src/data/curated.ts), keyed by Wikipedia
article title. For every artist the ingester (`src/scripts/ingest.ts`,
sharing `src/lib/collect.ts`):

1. resolves the **Wikipedia REST summary** → bio, portrait, Wikidata QID;
2. reads **birth / death / nationality** from Wikidata;
3. lists their **paintings** (`creator` + `image`) from Wikidata SPARQL,
   ranked by **Wikipedia sitelink count** (a fame proxy) so the most famous
   works are kept and `artworks[0]` is the artist's signature piece;
4. resolves each painting's real image URL, pixel dimensions and attribution
   from the **Commons `imageinfo` API**.

In the 3D gallery that signature piece is hung large and dramatically lit on
the **end wall** — the wall you face on entering, opposite the door — while the
rest line the side walls.

> **Coverage note.** Commons only hosts public-domain reproductions, so
> pre-20th-century wings fill richly while some modern masters (still under
> copyright) yield thinner rooms. The curation leans into the PD-rich eras.

## Controls

- **Timeline** — scroll to zoom, drag to pan, click a movement to focus it,
  click an artist to enter their gallery, `Esc` for the overview.
- **Gallery** — click to capture the mouse, `WASD` / arrows to walk, `Shift` to
  stride, look at a painting to read its caption, _Leave gallery_ to return.

## Tech

Next.js 15 · React 19 · React Three Fiber + drei + postprocessing · three.js ·
GSAP · Drizzle ORM · Neon serverless Postgres · Zustand.
