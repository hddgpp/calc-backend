const Database = require('better-sqlite3');
const db = new Database('licenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    code_hash TEXT NOT NULL,
    activated INTEGER DEFAULT 0,
    machine_id TEXT,
    activated_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;