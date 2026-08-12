import pg from 'pg';

// This safely looks at process.env for your Neon string loaded by your environment settings
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("⚠️ DATABASE_URL is undefined. Double-check your environment configuration paths.");
}

export const pool = new pg.Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false, // Essential for Neon cloud database requirements
  },
});