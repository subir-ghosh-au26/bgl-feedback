const express = require('express');
const router = express.Router();
const { generateQR } = require('../utils/qr');
const { requireAdmin } = require('../middleware/auth');

// ──────────────────────────────────────────────
// POST /api/admin/login  — Session-based admin auth
// ──────────────────────────────────────────────
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const validUser = process.env.ADMIN_USERNAME || 'admin';
    const validPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === validUser && password === validPass) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: 'Login successful' });
    }

    res.status(401).json({ error: 'Invalid credentials' });
});

// ──────────────────────────────────────────────
// POST /api/admin/logout  — Destroy session
// ──────────────────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('bgl.sid');
        res.json({ success: true, message: 'Logged out' });
    });
});

// ──────────────────────────────────────────────
// GET /api/admin/qrcode  — Get QR code (admin only)
// ──────────────────────────────────────────────
router.get('/qrcode', requireAdmin, async (req, res) => {
    try {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const feedbackUrl = `${baseUrl}/`;
        const qrDataUrl = await generateQR(feedbackUrl);
        res.json({ qrCode: qrDataUrl, url: feedbackUrl });
    } catch (err) {
        console.error('QR generation error:', err);
        res.status(500).json({ error: 'Failed to generate QR code.' });
    }
});

module.exports = router;
