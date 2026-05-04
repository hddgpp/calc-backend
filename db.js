const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      code_hash TEXT NOT NULL,
      activated INTEGER DEFAULT 0,
      machine_id TEXT,
      activated_at TEXT,
      expires_at TEXT,
      created_at TEXT DEFAULT now()::text
    );
  `);
}

init().catch(console.error);

module.exports = pool;