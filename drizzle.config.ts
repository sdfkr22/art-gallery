import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next.js keeps secrets in .env.local; load that first, then fall back to .env.
config({ path: '.env.local' });
config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
