const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { getDB, saveDB } = require('../utils/db');
const { requireAdmin } = require('../middleware/auth');

// ── Helpers ────────────────────────────────────
function stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').trim();
}

function sanitize(str, maxLen) {
    if (!str || typeof str !== 'string') return '';
    return stripHtml(str).substring(0, maxLen).trim();
}

function isValidEmail(email) {
    if (!email) return true; // optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ──────────────────────────────────────────────
// POST /api/feedback  — Submit new feedback (public)
// ──────────────────────────────────────────────
router.post('/', (req, res) => {
    try {
        const name = sanitize(req.body.name, 100);
        const email = sanitize(req.body.email, 200);
        const phone = sanitize(req.body.phone, 20);
        const category = sanitize(req.body.category, 50);
        const organisation = sanitize(req.body.organisation, 200);
        const rating = parseInt(req.body.rating);
        const message = sanitize(req.body.message, 500);

        // Validation
        if (!name || !category || !organisation || !message) {
            return res.status(400).json({ error: 'Name, category, organisation, and message are required.' });
        }
        if (isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }
        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const db = getDB();
        db.run(
            `INSERT INTO feedback (name, email, phone, category, organisation, rating, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, email, phone, category, organisation, rating, message]
        );
        saveDB();

        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (err) {
        console.error('Error saving feedback:', err);
        res.status(500).json({ error: 'Failed to save feedback.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback  — List all feedback (admin only)
// ──────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
    try {
        const db = getDB();
        const results = db.exec('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

        if (results.length === 0) {
            return res.json([]);
        }

        const columns = results[0].columns;
        const rows = results[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
        });

        res.json(rows);
    } catch (err) {
        console.error('Error fetching feedback:', err);
        res.status(500).json({ error: 'Failed to retrieve feedback.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback/stats  — Dashboard stats (admin only)
// ──────────────────────────────────────────────
router.get('/stats', requireAdmin, (req, res) => {
    try {
        const db = getDB();

        const totalResult = db.exec('SELECT COUNT(*) as total FROM feedback');
        const total = totalResult.length > 0 ? totalResult[0].values[0][0] : 0;

        const avgResult = db.exec('SELECT AVG(rating) as avg_rating FROM feedback');
        const avgRating = avgResult.length > 0 && avgResult[0].values[0][0] !== null
            ? parseFloat(avgResult[0].values[0][0]).toFixed(1)
            : '0.0';

        const todayResult = db.exec(
            `SELECT COUNT(*) as today FROM feedback WHERE date(created_at) = date('now', 'localtime')`
        );
        const today = todayResult.length > 0 ? todayResult[0].values[0][0] : 0;

        const ratingResult = db.exec(
            `SELECT rating, COUNT(*) as count FROM feedback GROUP BY rating ORDER BY rating`
        );
        const ratings = ratingResult.length > 0
            ? ratingResult[0].values.map(row => ({ rating: row[0], count: row[1] }))
            : [];

        res.json({ total, avgRating, today, ratings });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to retrieve stats.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback/export/excel  — Download Excel (admin only)
// ──────────────────────────────────────────────
router.get('/export/excel', requireAdmin, async (req, res) => {
    try {
        const db = getDB();
        const results = db.exec('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'BGL Feedback System';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Feedback', {
            properties: { tabColor: { argb: '6C63FF' } }
        });

        // Define columns
        sheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone', width: 18 },
            { header: 'Category', key: 'category', width: 18 },
            { header: 'Organisation', key: 'organisation', width: 30 },
            { header: 'Rating', key: 'rating', width: 10 },
            { header: 'Message', key: 'message', width: 50 },
            { header: 'Date', key: 'created_at', width: 22 }
        ];

        // Style header row
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: '6C63FF' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 30;

        // Add data rows
        if (results.length > 0) {
            const columns = results[0].columns;
            results[0].values.forEach((row, idx) => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                const dataRow = sheet.addRow(obj);
                dataRow.alignment = { vertical: 'middle', wrapText: true };
                if (idx % 2 === 0) {
                    dataRow.fill = {
                        type: 'pattern', pattern: 'solid',
                        fgColor: { argb: 'F5F5FF' }
                    };
                }
            });
        }

        // Add borders
        sheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'E0E0E0' } },
                    left: { style: 'thin', color: { argb: 'E0E0E0' } },
                    bottom: { style: 'thin', color: { argb: 'E0E0E0' } },
                    right: { style: 'thin', color: { argb: 'E0E0E0' } }
                };
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=feedback_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error exporting Excel:', err);
        res.status(500).json({ error: 'Failed to export Excel.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback/export/pdf  — Download PDF (admin only)
// ──────────────────────────────────────────────
router.get('/export/pdf', requireAdmin, (req, res) => {
    try {
        const db = getDB();
        const results = db.exec('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=feedback_${Date.now()}.pdf`);
        doc.pipe(res);

        // Title
        doc.fontSize(22).fillColor('#6C63FF').text('BGL Feedback Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#888').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);

        if (results.length === 0 || results[0].values.length === 0) {
            doc.fontSize(14).fillColor('#333').text('No feedback entries found.', { align: 'center' });
            doc.end();
            return;
        }

        const rows = results[0].values;

        // Table configuration — 7 columns (no category)
        const colWidths = [30, 75, 100, 70, 70, 90, 35, 180, 85];
        const headers = ['ID', 'Name', 'Email', 'Phone', 'Category', 'Organisation', 'Rating', 'Message', 'Date'];
        const startX = 40;
        let y = doc.y;

        // Draw header row
        const drawHeader = (yPos) => {
            doc.fontSize(9).fillColor('#FFFFFF');
            let x = startX;
            headers.forEach((header, i) => {
                doc.rect(x, yPos, colWidths[i], 25).fill('#6C63FF');
                doc.fillColor('#FFFFFF').text(header, x + 4, yPos + 7, { width: colWidths[i] - 8, lineBreak: false });
                x += colWidths[i];
            });
        };

        drawHeader(y);
        y += 25;

        // Draw data rows
        doc.fontSize(8).fillColor('#333');
        rows.forEach((row, rowIdx) => {
            if (y > doc.page.height - 60) {
                doc.addPage();
                y = 40;
                drawHeader(y);
                y += 25;
                doc.fontSize(8).fillColor('#333');
            }

            const bgColor = rowIdx % 2 === 0 ? '#F8F8FF' : '#FFFFFF';
            let x = startX;
            row.forEach((cell, i) => {
                doc.rect(x, y, colWidths[i], 22).fill(bgColor);
                doc.fillColor('#333').text(
                    String(cell || ''),
                    x + 4, y + 6,
                    { width: colWidths[i] - 8, lineBreak: false, ellipsis: true }
                );
                x += colWidths[i];
            });
            y += 22;
        });

        // Footer
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#aaa').text(
            `Total entries: ${rows.length}`,
            40, doc.page.height - 40,
            { align: 'center', width: doc.page.width - 80 }
        );

        doc.end();
    } catch (err) {
        console.error('Error exporting PDF:', err);
        res.status(500).json({ error: 'Failed to export PDF.' });
    }
});

module.exports = router;
