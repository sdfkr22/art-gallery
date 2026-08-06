# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**The Infinite Gallery** — an interactive 3D art-history museum in the browser. The UI has two views: an infinite semantic-zoom **timeline** of periods/artists, and a first-person **3D gallery** (WebGL) you walk through when you pick an artist. Editorial structure is hand-curated; all the actual content (bios, portraits, paintings, dates, dimensions) is pulled live from Wikimedia.

Stack: Next.js 15 (App Router) + React 19 · React Three Fiber + drei + @react-three/postprocessing · GSAP · Drizzle ORM + Neon serverless Postgres · Zustand.

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build
npm run lint         # next lint

npm run db:push      # push Drizzle schema to Neon (needs DATABASE_URL)
npm run db:studio    # Drizzle Studio
npm run ingest       # crawl Wikimedia -> Neon for ALL periods
npm run ingest -- impressionism post-impressionism   # only these period slugs
npm run snapshot     # rebuild src/data/snapshot.json (the no-DB fallback)
```

There is no test suite.

## Two data modes — this is the central architectural fact

`src/db/index.ts` exports `db` (Drizzle/Neon client) and `hasDatabase`. If `DATABASE_URL` is set, `db` is a live client; otherwise it is `null`.

`src/lib/queries.ts` is the single data-access layer and branches on `db`:
- **Live mode** (`DATABASE_URL` set): reads from Neon.
- **Snapshot mode** (no env): reads the bundled `src/data/snapshot.json`.

Both branches return identical DTO shapes (`src/lib/types.ts`), so the rest of the app never knows which mode is active. **When changing one branch, change the other to match.** The snapshot is built offline by `npm run snapshot` so the app always renders something with zero infra.

> Per project memory: `.env.local` currently holds a real `DATABASE_URL`, so this checkout runs in **LIVE Neon mode**. Changes to ranking/collection logic only show up after re-running `npm run ingest`; editing `snapshot.json` has no effect in live mode.

## Request/render flow

1. `src/app/page.tsx` (server component) calls `getTimeline()` and renders `<Museum periods live={hasDatabase}>`.
2. `src/components/Museum.tsx` (client) holds the GSAP crossfade between timeline and gallery, and on artist selection fetches `/api/artists/[slug]`.
3. View state lives in a tiny Zustand store, `src/lib/store.ts` (`view`, `artistSlug`, `transitioning`). `openGallery(slug)` / `closeGallery()` drive everything.
4. API routes (`src/app/api/timeline`, `src/app/api/artists/[slug]`) are thin wrappers over `queries.ts` with `revalidate = 3600`.

## Ingestion pipeline (curated → Wikimedia → Neon)

- `src/data/curated.ts` is the editorial backbone: an ordered list of `CURATED_PERIODS`, each with artists keyed by **exact English Wikipedia article title** (so the ingester resolves a stable Wikidata QID without hand-maintaining IDs). `fame` (0..1) orders artists/rooms. This is the file you edit to add periods or artists.
- `src/lib/wikimedia.ts` holds the raw Wikipedia REST / Wikidata SPARQL / Commons `imageinfo` fetchers.
- `src/lib/collect.ts` (`collectArtist`) is the shared "fetch one artist + paintings" routine used by **both** the Neon ingester and the snapshot builder. It dedupes images, filters tiny ones (`<400px`), and ranks artworks by **Wikipedia sitelink count** (fame), high-res as tiebreaker. `MAX_ARTWORKS_PER_ARTIST = 12`. **`artworks[0]` is the signature/hero piece.**
- `src/scripts/ingest.ts` upserts periods → artists → artworks into Neon. It is idempotent: it **deletes an artist's existing artworks before inserting** the new set, so a re-ingest can't leave stale paintings behind.
- `src/scripts/build-snapshot.ts` runs the same collection but writes `snapshot.json` instead of the DB.

Schema lives in `src/db/schema.ts` (`periods` → `artists` → `artworks`, cascade deletes, slug unique indexes).

### Coverage constraint (by design, not a bug)
Wikimedia Commons only hosts **public-domain** images. Pre-1900 periods fill richly; 20th-century masters still under copyright (Picasso, Dalí, etc.) yield thin or empty rooms. `GalleryView` renders an explicit empty state for those. `upload.wikimedia.org` sends `access-control-allow-origin: *`, so textures load into WebGL fine.

## 3D gallery internals (`src/components/gallery`)

- `dims.ts` — the shared architecture (room height/width, entrance z, lighting-track position, bench layout + collision boxes). `Room`, `Painting` and `Player` all have to agree on these and none owns the others, so they live here. **Change geometry here, not in the components.**
- `GalleryView.tsx` — the `<Canvas>` host plus all the 2D HUD overlays (reticle, focused-artwork caption, placard, loading/empty states). Tone mapping is done in post (`NoToneMapping` on the renderer).
- `Scene.tsx` — `layoutArtworks()` places the hero (`artworks[0]`) large and centered on the **end wall** (opposite the entrance) and alternates the rest down the two side walls; positions sit *exactly on the wall plane* and each frame protrudes into the room from there. Also wires `EffectComposer`, the studio `Environment`, fog, `FocusTracker` (center-screen raycast), `Dust`, `StaticShadows` and `Player`.
- `Room.tsx` — hall architecture: reflective limestone floor, period-tinted plaster walls, oak skirting + picture rail, coffered ceiling with luminous laylight panels, cove lighting, lighting track, benches, and a doorway onto a lit vestibule. Origin = entrance; hall runs along +z to `length`.
- `Player.tsx` — pointer-lock first-person controls (click to look, WASD to walk) with a velocity model, head bob, and AABB pushback against the benches.
- `Painting.tsx` / `Placard.tsx` — canvas + four-rail frame + its ceiling spot, and the artist info card.
- `textures.ts` — procedural stone / plaster / oak / canvas-weave maps, generated once and cached at module level. No network assets.
- `exposure.ts` — per-painting auto-exposure (see below).

### Lighting model — read this before touching brightness
Every painting is lit by **one ceiling track spot solved from geometry**, not by a hand-picked intensity. `Painting.tsx` computes the spot's intensity so a pure-white pixel lands on `WHITE_POINT` (~0.76 radiance) whatever the canvas's size or hanging height; the room's fill adds roughly another 0.2 on top, putting white just at the top of the ACES curve. Consequences:

- **`decay` is 1, not the physical 2.** Over a 2 m canvas, inverse-square falloff from a fixture this close makes the top ~4× brighter than the bottom — the "top blown out, bottom mud" look.
- **Bloom's `luminanceThreshold` is above 1.0 on purpose.** Paintings peak around white; blooming them is exactly what turns a pale canvas into an unreadable glowing rectangle. Only emissive fixtures (laylights, lamp lenses) are meant to flare.
- **`exposure.ts` dims or lifts each painting individually.** It samples the decoded texture down to 32×32, measures mean and 92nd-percentile linear luminance, and returns a gain (0.4–2.1) for that painting's spot — pale works get less light, dark works more. Without it a Turner sky and a Rembrandt interior cannot both be legible under one fixture.
- The paintings carry **no emissive**. If art looks dark, fix the light budget above; don't reintroduce self-illumination.

### Two gotchas that cost real debugging time
- **Coplanar surfaces z-fight.** The canvas plane and the stretcher box behind it must not share a z; at some viewing distances the dark wood wins and the painting reads as an empty black frame.
- **A plane faces its local +z.** The entrance wall must *not* be rotated by π or it back-face culls into nothing when you turn round.

### Robustness
Texture failures used to take the whole canvas down. `PaintingBoundary` in `Scene.tsx` now catches them, clears the loader cache and remounts up to 3 times with backoff (twelve full-size Commons images at once will occasionally earn a 429). Only a genuinely dead URL ends as one blank patch of wall.

Shadow maps are static: `StaticShadows` sets `gl.shadowMap.autoUpdate = false` and only re-renders for ~2.5 s after a painting mounts. Nothing in the hall moves, so ~13 shadowed spotlights cost one render, not sixty a second. **If you ever animate scene geometry, this has to change.**

If a hero painting looks wrong in live mode, it's almost always stale Neon data needing a re-ingest, not a layout bug.

## Conventions

- Path alias `@/*` → `src/*`.
- DTOs are keyed by `slug` (artists/periods) and artworks carry a stable `key` = Wikidata QID.
- `next.config.mjs` allowlists `upload.wikimedia.org` / `commons.wikimedia.org` for `next/image` and transpiles `three`.
- Both `drizzle.config.ts` and `ingest.ts` load `.env.local` first, then `.env`.
