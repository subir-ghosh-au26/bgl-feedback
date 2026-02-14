require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const { initDB, saveDB } = require('./utils/db');
const { generateSecret } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── Security Headers ────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
        }
    }
}));

// ── Compression ─────────────────────────────────
app.use(compression());

// ── Request Logging ─────────────────────────────
app.use(morgan(isProd ? 'combined' : 'dev'));

// ── Rate Limiting (global) ──────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(globalLimiter);

// ── Body Parsing (capped at 10kb) ───────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Session (for admin auth) ────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || generateSecret(),
    resave: false,
    saveUninitialized: false,
    name: 'bgl.sid',
    cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000 // 2 hours
    }
}));

// ── Static Files (with cache headers in prod) ───
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: isProd ? '1d' : 0,
    etag: true
}));

// ── Stricter rate limit for feedback submission ──
const feedbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many feedback submissions. Please try again later.' }
});
app.use('/api/feedback', (req, res, next) => {
    if (req.method === 'POST') return feedbackLimiter(req, res, next);
    next();
});

// ── Clean URL redirects ─────────────────────────
app.get('/admin', (req, res) => res.redirect('/admin.html'));

// ── Routes ──────────────────────────────────────
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));

// ── 404 Handler ─────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ── Global Error Handler ────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack || err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ────────────────────────────────
(async () => {
    await initDB();
    const server = app.listen(PORT, () => {
        console.log(`\n🚀 BGL Feedback System running at http://localhost:${PORT}`);
        console.log(`📋 Feedback Form:  http://localhost:${PORT}/`);
        console.log(`🔐 Admin Dashboard: http://localhost:${PORT}/admin.html`);
        console.log(`🔒 Environment: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);
    });

    // ── Graceful Shutdown ───────────────────────────
    const shutdown = (signal) => {
        console.log(`\n⏹ ${signal} received. Shutting down gracefully...`);
        server.close(() => {
            console.log('✅ Server closed.');
            process.exit(0);
        });
        // Force close after 5s
        setTimeout(() => {
            console.error('⚠ Forced shutdown after timeout.');
            process.exit(1);
        }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
})();
