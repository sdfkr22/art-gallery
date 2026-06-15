/**
 * Thin clients for the three Wikimedia surfaces we read from:
 *   - Wikipedia REST  : artist bio + portrait + the artist's Wikidata QID
 *   - Wikidata SPARQL : artist facts + the list of their paintings (with images)
 *   - Commons API     : full image URLs, pixel dimensions, licence/attribution
 *
 * All requests carry a descriptive User-Agent per the Wikimedia API etiquette.
 */

const USER_AGENT =
  'ArtHistoryMuseum/0.1 (educational 3D gallery; https://github.com/example/art-history-museum) node-fetch';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getJson<T>(
  url: string,
  accept = 'application/json',
  timeoutMs = 25000,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/* ------------------------------- Wikipedia ------------------------------- */

export interface WikiSummary {
  title: string;
  extract: string;
  qid: string | null;
  thumbnail: string | null;
  pageUrl: string | null;
}

/** Fetch the lead summary + portrait + Wikidata QID for an article title. */
export async function fetchWikipediaSummary(
  title: string,
): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_'),
  )}?redirect=true`;
  try {
    const data = await getJson<any>(url);
    if (data.type === 'disambiguation') return null;
    return {
      title: data.title ?? title,
      extract: data.extract ?? '',
      qid: data.wikibase_item ?? null,
      thumbnail: data.originalimage?.source ?? data.thumbnail?.source ?? null,
      pageUrl: data.content_urls?.desktop?.page ?? null,
    };
  } catch {
    return null;
  }
}

/* -------------------------------- Wikidata ------------------------------- */

async function sparql(query: string): Promise<any[]> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson<any>(url, 'application/sparql-results+json', 45000);
  return data.results?.bindings ?? [];
}

export interface ArtistFacts {
  birthYear: number | null;
  deathYear: number | null;
  nationality: string | null;
}

export async function fetchArtistFacts(qid: string): Promise<ArtistFacts> {
  const query = `
    SELECT ?birth ?death ?countryLabel WHERE {
      OPTIONAL { wd:${qid} wdt:P569 ?birth. }
      OPTIONAL { wd:${qid} wdt:P570 ?death. }
      OPTIONAL { wd:${qid} wdt:P27 ?country. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 1`;
  const rows = await sparql(query);
  const r = rows[0] ?? {};
  const year = (v?: { value: string }) =>
    v?.value ? parseInt(v.value.slice(0, v.value.startsWith('-') ? 5 : 4), 10) : null;
  return {
    birthYear: year(r.birth),
    deathYear: year(r.death),
    nationality: r.countryLabel?.value ?? null,
  };
}

export interface RawArtwork {
  qid: string;
  title: string;
  year: number | null;
  /** Commons File: title, e.g. "File:Mona Lisa.jpg" */
  fileTitle: string;
  medium: string | null;
  /** Number of Wikipedia language editions linking this work — a fame proxy. */
  sitelinks: number;
}

/**
 * All paintings whose creator (P170) is the given artist QID and that carry an
 * image (P18). We bias toward "painting" instance-of where possible but keep
 * the query permissive so thinner œuvres still return work.
 */
export async function fetchArtistArtworks(
  qid: string,
  limit = 30,
): Promise<RawArtwork[]> {
  // Inner subquery does the heavy sort-by-fame + limit WITHOUT labels; the
  // label service then runs on only the surviving rows (much faster, avoids
  // timeouts for prolific artists). Ordering by sitelinks in the query keeps
  // the most famous works rather than an arbitrary slice.
  const query = `
    SELECT ?work ?workLabel ?image ?inception ?sitelinks WHERE {
      {
        SELECT ?work ?image ?inception ?sitelinks WHERE {
          ?work wdt:P170 wd:${qid} ;
                wdt:P18 ?image ;
                wikibase:sitelinks ?sitelinks .
          OPTIONAL { ?work wdt:P571 ?inception. }
        }
        ORDER BY DESC(?sitelinks)
        LIMIT ${limit}
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    ORDER BY DESC(?sitelinks)`;
  const rows = await sparql(query);
  const out: RawArtwork[] = [];
  for (const r of rows) {
    const label: string = r.workLabel?.value ?? '';
    // Skip rows whose label is just the bare QID (no human title).
    if (!label || /^Q\d+$/.test(label)) continue;
    const imageUrl: string = r.image?.value ?? '';
    const fileName = decodeURIComponent(imageUrl.split('/Special:FilePath/')[1] ?? '');
    if (!fileName) continue;
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext)) continue;
    const inception: string | undefined = r.inception?.value;
    const year = inception
      ? parseInt(inception.slice(0, inception.startsWith('-') ? 5 : 4), 10)
      : null;
    out.push({
      qid: (r.work?.value ?? '').split('/').pop() ?? '',
      title: label,
      year: Number.isFinite(year) ? year : null,
      fileTitle: `File:${fileName}`,
      medium: null,
      sitelinks: parseInt(r.sitelinks?.value ?? '0', 10) || 0,
    });
  }
  return out;
}

/* --------------------------------- Commons ------------------------------- */

export interface CommonsImage {
  /** Direct full-resolution original URL. */
  url: string;
  /** Server-scaled thumbnail (~1600px wide). */
  thumbUrl: string;
  width: number;
  height: number;
  descUrl: string;
  credit: string | null;
}

/**
 * Resolve up to a batch of File: titles to real image URLs + dimensions +
 * attribution in one imageinfo call.
 */
export async function fetchCommonsImages(
  fileTitles: string[],
): Promise<Map<string, CommonsImage>> {
  const result = new Map<string, CommonsImage>();
  if (fileTitles.length === 0) return result;

  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodeURIComponent(fileTitles.join('|'))}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&origin=*`;
  const data = await getJson<any>(url);
  const pages = data.query?.pages ?? {};
  const normalized: Record<string, string> = {};
  for (const n of data.query?.normalized ?? []) normalized[n.to] = n.from;

  for (const key of Object.keys(pages)) {
    const page = pages[key];
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const credit =
      meta.Artist?.value?.replace(/<[^>]+>/g, '').trim() ||
      meta.Credit?.value?.replace(/<[^>]+>/g, '').trim() ||
      null;
    const canonical = page.title as string;
    const original = normalized[canonical] ?? canonical;
    const entry: CommonsImage = {
      url: info.url,
      thumbUrl: info.thumburl ?? info.url,
      width: info.width ?? 0,
      height: info.height ?? 0,
      descUrl: info.descriptionurl ?? '',
      credit,
    };
    result.set(canonical, entry);
    result.set(original, entry);
  }
  return result;
}
