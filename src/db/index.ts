import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Drizzle client over Neon's serverless HTTP driver. Safe to import from
 * Next.js route handlers / server components.
 *
 * If DATABASE_URL is not set we export `null` so the API layer can fall back
 * to the bundled JSON snapshot (see src/data/snapshot.json + api routes).
 */
const connectionString = process.env.DATABASE_URL;

export const hasDatabase = Boolean(connectionString);

export const db = connectionString
  ? drizzle(neon(connectionString), { schema })
  : null;

export { schema };
