const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { getDB } = require('../utils/db');
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
router.post('/', async (req, res) => {
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
        await db.execute({
            sql: `INSERT INTO feedback (name, email, phone, category, organisation, rating, message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [name, email, phone, category, organisation, rating, message]
        });

        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (err) {
        console.error('Error saving feedback:', err);
        res.status(500).json({ error: 'Failed to save feedback.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback  — List all feedback (admin only)
// ──────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const db = getDB();
        const result = await db.execute('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

        // Turso returns rows as an array of objects
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching feedback:', err);
        res.status(500).json({ error: 'Failed to retrieve feedback.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/feedback/stats  — Dashboard stats (admin only)
// ──────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const db = getDB();

        const totalResult = await db.execute('SELECT COUNT(*) as total FROM feedback');
        const total = totalResult.rows[0].total;

        const avgResult = await db.execute('SELECT AVG(rating) as avg_rating FROM feedback');
        const avgRaw = avgResult.rows[0].avg_rating;
        const avgRating = avgRaw !== null ? parseFloat(avgRaw).toFixed(1) : '0.0';

        const todayResult = await db.execute(
            `SELECT COUNT(*) as today FROM feedback WHERE date(created_at) = date('now', 'localtime')`
        );
        const today = todayResult.rows[0].today;

        const ratingResult = await db.execute(
            `SELECT rating, COUNT(*) as count FROM feedback GROUP BY rating ORDER BY rating`
        );
        const ratings = ratingResult.rows.map(row => ({ rating: row.rating, count: row.count }));

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
        const result = await db.execute('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

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
        result.rows.forEach((row, idx) => {
            const dataRow = sheet.addRow(row);
            dataRow.alignment = { vertical: 'middle', wrapText: true };
            if (idx % 2 === 0) {
                dataRow.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: 'F5F5FF' }
                };
            }
        });

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
router.get('/export/pdf', requireAdmin, async (req, res) => {
    try {
        const db = getDB();
        const result = await db.execute('SELECT id, name, email, phone, category, organisation, rating, message, created_at FROM feedback ORDER BY created_at DESC');

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=feedback_${Date.now()}.pdf`);
        doc.pipe(res);

        // Title
        doc.fontSize(22).fillColor('#6C63FF').text('BGL Feedback Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#888').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(1);

        if (result.rows.length === 0) {
            doc.fontSize(14).fillColor('#333').text('No feedback entries found.', { align: 'center' });
            doc.end();
            return;
        }

        const rows = result.rows;

        // Table configuration
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
        rows.forEach((rowObj, rowIdx) => {
            if (y > doc.page.height - 60) {
                doc.addPage();
                y = 40;
                drawHeader(y);
                y += 25;
                doc.fontSize(8).fillColor('#333');
            }

            const bgColor = rowIdx % 2 === 0 ? '#F8F8FF' : '#FFFFFF';
            let x = startX;

            // Map object to array to match headers
            const rowValues = [
                rowObj.id, rowObj.name, rowObj.email, rowObj.phone,
                rowObj.category, rowObj.organisation, rowObj.rating,
                rowObj.message, rowObj.created_at
            ];

            rowValues.forEach((cell, i) => {
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
