const crypto = require('crypto');

/**
 * Middleware to require admin authentication via session.
 * Returns 401 if not logged in.
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

/**
 * Generate a cryptographically secure session secret if none provided.
 */
function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

module.exports = { requireAdmin, generateSecret };
