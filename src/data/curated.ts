/**
 * Editorial backbone of the museum: which periods exist and which artists
 * belong to each. Everything else (bios, portraits, paintings, dates,
 * dimensions) is pulled live from the Wikipedia REST API + Wikidata + Commons
 * by the ingestion script (src/scripts/ingest.ts).
 *
 * Artists are keyed by their *English Wikipedia article title* so the ingester
 * can resolve them to a stable Wikidata QID without us hand-maintaining IDs.
 *
 * Periods are roughly chronological. `startYear`/`endYear` drive the timeline
 * layout (negative = BCE). `color` themes the timeline marker + gallery accent.
 *
 * Coverage note: Wikimedia Commons only hosts public-domain reproductions, so
 * pre-20th-century periods fill richly while some modern masters (still under
 * copyright) yield thinner rooms. The curation leans into the PD-rich eras.
 */

export interface CuratedArtist {
  /** Exact English Wikipedia article title. */
  title: string;
  /** Display name override (defaults to title). */
  name?: string;
  /** Hand fame weight 0..1 to order rooms; higher shows first. */
  fame?: number;
}

export interface CuratedPeriod {
  slug: string;
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  blurb: string;
  artists: CuratedArtist[];
}

export const CURATED_PERIODS: CuratedPeriod[] = [
  {
    slug: 'gothic',
    name: 'Gothic & Proto-Renaissance',
    startYear: 1200,
    endYear: 1400,
    color: '#7b5e9b',
    blurb:
      'Late-medieval painting breaks from flat Byzantine icons toward weight, space and human emotion.',
    artists: [
      { title: 'Giotto', name: 'Giotto di Bondone', fame: 0.95 },
      { title: 'Duccio', fame: 0.7 },
      { title: 'Simone Martini', fame: 0.6 },
      { title: 'Cimabue', fame: 0.6 },
      { title: 'Ambrogio Lorenzetti', fame: 0.5 },
    ],
  },
  {
    slug: 'early-renaissance',
    name: 'Early Renaissance',
    startYear: 1400,
    endYear: 1490,
    color: '#3f7d6e',
    blurb:
      'Florence rediscovers linear perspective and classical antiquity; painting becomes a science of space.',
    artists: [
      { title: 'Sandro Botticelli', fame: 0.95 },
      { title: 'Masaccio', fame: 0.7 },
      { title: 'Fra Angelico', fame: 0.7 },
      { title: 'Piero della Francesca', fame: 0.75 },
      { title: 'Paolo Uccello', fame: 0.6 },
      { title: 'Andrea Mantegna', fame: 0.65 },
    ],
  },
  {
    slug: 'high-renaissance',
    name: 'High Renaissance',
    startYear: 1490,
    endYear: 1530,
    color: '#b5462f',
    blurb:
      'A brief, dazzling apex of balance and idealized beauty led by Leonardo, Michelangelo and Raphael.',
    artists: [
      { title: 'Leonardo da Vinci', fame: 1.0 },
      { title: 'Michelangelo', fame: 1.0 },
      { title: 'Raphael', fame: 0.95 },
      { title: 'Titian', fame: 0.9 },
      { title: 'Giorgione', fame: 0.6 },
    ],
  },
  {
    slug: 'northern-renaissance',
    name: 'Northern Renaissance',
    startYear: 1430,
    endYear: 1580,
    color: '#2f6690',
    blurb:
      'Flemish and German masters obsess over oil glazes, microscopic detail and unsettling symbolism.',
    artists: [
      { title: 'Jan van Eyck', fame: 0.9 },
      { title: 'Albrecht Dürer', fame: 0.9 },
      { title: 'Hieronymus Bosch', fame: 0.9 },
      { title: 'Pieter Bruegel the Elder', fame: 0.85 },
      { title: 'Hans Holbein the Younger', fame: 0.7 },
    ],
  },
  {
    slug: 'mannerism',
    name: 'Mannerism',
    startYear: 1520,
    endYear: 1600,
    color: '#8a5a44',
    blurb:
      'Elegant artifice and elongated, restless figures stretch Renaissance harmony to its breaking point.',
    artists: [
      { title: 'El Greco', fame: 0.85 },
      { title: 'Tintoretto', fame: 0.75 },
      { title: 'Pontormo', fame: 0.6 },
      { title: 'Parmigianino', fame: 0.6 },
      { title: 'Agnolo Bronzino', name: 'Bronzino', fame: 0.6 },
    ],
  },
  {
    slug: 'baroque',
    name: 'Baroque',
    startYear: 1600,
    endYear: 1730,
    color: '#9c6b1e',
    blurb:
      'Theatrical light, deep shadow and raw drama pull the viewer bodily into the scene.',
    artists: [
      { title: 'Caravaggio', fame: 0.95 },
      { title: 'Rembrandt', fame: 1.0 },
      { title: 'Johannes Vermeer', fame: 0.95 },
      { title: 'Peter Paul Rubens', fame: 0.9 },
      { title: 'Diego Velázquez', fame: 0.9 },
      { title: 'Artemisia Gentileschi', fame: 0.75 },
    ],
  },
  {
    slug: 'rococo',
    name: 'Rococo',
    startYear: 1700,
    endYear: 1780,
    color: '#c98aa6',
    blurb:
      'Aristocratic frivolity in pastel: feathery brushwork, flirtation and gilded excess.',
    artists: [
      { title: 'Jean-Honoré Fragonard', fame: 0.75 },
      { title: 'François Boucher', fame: 0.7 },
      { title: 'Antoine Watteau', fame: 0.75 },
      { title: 'Canaletto', fame: 0.7 },
      { title: 'Giovanni Battista Tiepolo', fame: 0.65 },
    ],
  },
  {
    slug: 'neoclassicism',
    name: 'Neoclassicism',
    startYear: 1760,
    endYear: 1830,
    color: '#5b6770',
    blurb:
      'A sober return to Greco-Roman order, civic virtue and crisp, sculptural line.',
    artists: [
      { title: 'Jacques-Louis David', fame: 0.85 },
      { title: 'Jean-Auguste-Dominique Ingres', fame: 0.8 },
      { title: 'Angelica Kauffman', fame: 0.6 },
      { title: 'Antonio Canova', fame: 0.6 },
    ],
  },
  {
    slug: 'romanticism',
    name: 'Romanticism',
    startYear: 1800,
    endYear: 1860,
    color: '#7d3a3a',
    blurb:
      'Emotion over reason: sublime storms, exotic violence and the lone soul against nature.',
    artists: [
      { title: 'Eugène Delacroix', fame: 0.85 },
      { title: 'Francisco Goya', fame: 0.95 },
      { title: 'J. M. W. Turner', name: 'J. M. W. Turner', fame: 0.9 },
      { title: 'Caspar David Friedrich', fame: 0.85 },
      { title: 'Théodore Géricault', fame: 0.7 },
      { title: 'John Constable', fame: 0.75 },
    ],
  },
  {
    slug: 'realism',
    name: 'Realism',
    startYear: 1840,
    endYear: 1880,
    color: '#4a5240',
    blurb:
      'Painters turn from myth to the unglamorous truth of labourers, peasants and modern life.',
    artists: [
      { title: 'Gustave Courbet', fame: 0.8 },
      { title: 'Jean-François Millet', fame: 0.75 },
      { title: 'Ilya Repin', fame: 0.75 },
      { title: 'Honoré Daumier', fame: 0.6 },
    ],
  },
  {
    slug: 'impressionism',
    name: 'Impressionism',
    startYear: 1860,
    endYear: 1900,
    color: '#3d8aa8',
    blurb:
      'Broken colour and fleeting light, painted outdoors to catch a single passing moment.',
    artists: [
      { title: 'Claude Monet', fame: 1.0 },
      { title: 'Pierre-Auguste Renoir', fame: 0.9 },
      { title: 'Edgar Degas', fame: 0.9 },
      { title: 'Édouard Manet', fame: 0.9 },
      { title: 'Camille Pissarro', fame: 0.75 },
      { title: 'Berthe Morisot', fame: 0.7 },
    ],
  },
  {
    slug: 'post-impressionism',
    name: 'Post-Impressionism',
    startYear: 1885,
    endYear: 1910,
    color: '#d98a2b',
    blurb:
      'Personal vision over observation: structure, symbol and raw colour push toward modern art.',
    artists: [
      { title: 'Vincent van Gogh', fame: 1.0 },
      { title: 'Paul Cézanne', fame: 0.95 },
      { title: 'Paul Gauguin', fame: 0.9 },
      { title: 'Georges Seurat', fame: 0.85 },
      { title: 'Henri de Toulouse-Lautrec', fame: 0.8 },
    ],
  },
  {
    slug: 'symbolism-secession',
    name: 'Symbolism & Secession',
    startYear: 1880,
    endYear: 1910,
    color: '#9a7d2e',
    blurb:
      'Dreams, eros and dread rendered in gold leaf and decorative line at the turn of the century.',
    artists: [
      { title: 'Gustav Klimt', fame: 0.9 },
      { title: 'Edvard Munch', fame: 0.9 },
      { title: 'Odilon Redon', fame: 0.65 },
      { title: 'Gustave Moreau', fame: 0.6 },
    ],
  },
  {
    slug: 'early-modern',
    name: 'Early Modernism',
    startYear: 1905,
    endYear: 1945,
    color: '#6a6f9c',
    blurb:
      'Cubism, abstraction and Surrealism shatter the single viewpoint. (Many works remain in copyright, so this wing is intimate.)',
    artists: [
      { title: 'Henri Matisse', fame: 0.9 },
      { title: 'Pablo Picasso', fame: 1.0 },
      { title: 'Wassily Kandinsky', fame: 0.85 },
      { title: 'Piet Mondrian', fame: 0.8 },
      { title: 'Egon Schiele', fame: 0.75 },
    ],
  },
];
