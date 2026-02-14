const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'feedback.db');

let db = null;

/**
 * Initialize the SQLite database (sql.js — pure JS, no native deps).
 * Loads existing DB file if present, otherwise creates a new one.
 */
async function initDB() {
    const SQL = await initSqlJs();

    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing database or create a new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create feedback table
    db.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      category TEXT DEFAULT '',
      organisation TEXT DEFAULT '',
      rating INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `);

    saveDB();
    console.log('✅ Database initialized');
    return db;
}

/** Persist the in-memory database to disk */
function saveDB() {
    if (db) {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(DB_PATH, buffer);
        } catch (err) {
            console.error('❌ Failed to save database:', err);
        }
    }
}

/** Get the current database instance */
function getDB() {
    return db;
}

module.exports = { initDB, getDB, saveDB };
