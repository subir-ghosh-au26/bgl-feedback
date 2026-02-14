const { createClient } = require('@libsql/client');

let db = null;

/**
 * Initialize the Turso (libSQL) database connection.
 * Uses environment variables for URL and Auth Token.
 */
async function initDB() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.warn('⚠️ TURSO_DATABASE_URL is not set. Falling back to local SQLite file for development.');
    }

    // Connect to Turso (or local file if URL is missing)
    db = createClient({
        url: url || 'file:data/feedback.db',
        authToken: authToken
    });

    // Create feedback table if it doesn't exist
    await db.execute(`
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

    console.log('✅ Database connection initialized');
    return db;
}

/** Get the current database instance */
function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB() first.');
    }
    return db;
}

// saveDB is no longer needed as Turso auto-persists changes to the cloud
function saveDB() {
    // No-op for cloud database
}

module.exports = { initDB, getDB, saveDB };
