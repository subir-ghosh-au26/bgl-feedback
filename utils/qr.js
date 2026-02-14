const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'images', 'logo.jpg');

// ── Dark navy — matches the BGL logo palette ───
const QR_COLOR = '#1B2D5B';
const BG_COLOR = '#ffffff';

// ── Check if module is dark ─────────────────────
function isDark(data, count, row, col) {
  if (row < 0 || row >= count || col < 0 || col >= count) return false;
  return !!data[row * count + col];
}

// ── Finder pattern zone detection ───────────────
function isFinderZone(row, col, count) {
  // 7×7 finder + 1 cell separator
  if (row < 8 && col < 8) return true;
  if (row < 8 && col >= count - 8) return true;
  if (row >= count - 8 && col < 8) return true;
  return false;
}

/**
 * Build an SVG path for a rounded rectangle with individual corner radii.
 * Corners are rounded only where the module has NO adjacent dark neighbor.
 */
function roundedModulePath(x, y, s, rtl, rtr, rbr, rbl) {
  // rtl = top-left radius, rtr = top-right, rbr = bottom-right, rbl = bottom-left
  return [
    `M${x + rtl},${y}`,
    `H${x + s - rtr}`,
    rtr ? `Q${x + s},${y},${x + s},${y + rtr}` : `L${x + s},${y}`,
    `V${y + s - rbr}`,
    rbr ? `Q${x + s},${y + s},${x + s - rbr},${y + s}` : `L${x + s},${y + s}`,
    `H${x + rbl}`,
    rbl ? `Q${x},${y + s},${x},${y + s - rbl}` : `L${x},${y + s}`,
    `V${y + rtl}`,
    rtl ? `Q${x},${y},${x + rtl},${y}` : `L${x},${y}`,
    'Z'
  ].join('');
}

// ── Build the full SVG ──────────────────────────
function buildSVG(modules, cellSize, margin) {
  const count = modules.size;
  const data = modules.data;
  const qrPx = count * cellSize;
  const size = qrPx + margin * 2;
  const r = cellSize * 0.42;            // corner radius for isolated edges

  const paths = [];

  // ── Data modules — connected rounded shapes ──
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!isDark(data, count, row, col)) continue;
      if (isFinderZone(row, col, count)) continue;

      const x = margin + col * cellSize;
      const y = margin + row * cellSize;

      // Check 4 neighbors
      const top = isDark(data, count, row - 1, col);
      const right = isDark(data, count, row, col + 1);
      const bottom = isDark(data, count, row + 1, col);
      const left = isDark(data, count, row, col - 1);

      // Round a corner only when BOTH adjacent edges are empty
      const rtl = (!top && !left) ? r : 0;
      const rtr = (!top && !right) ? r : 0;
      const rbr = (!bottom && !right) ? r : 0;
      const rbl = (!bottom && !left) ? r : 0;

      paths.push(roundedModulePath(x, y, cellSize, rtl, rtr, rbr, rbl));
    }
  }

  // ── Styled finder patterns (3 eyes) ──────────
  const finderOrigins = [
    { r: 0, c: 0 },
    { r: 0, c: count - 7 },
    { r: count - 7, c: 0 }
  ];

  const eyePaths = [];
  for (const origin of finderOrigins) {
    const ox = margin + origin.c * cellSize;
    const oy = margin + origin.r * cellSize;
    const outer = 7 * cellSize;
    const mid = 5 * cellSize;
    const inner = 3 * cellSize;

    const ro = cellSize * 1.8;   // outer rounding
    const rm = cellSize * 1.2;   // mid rounding
    const ri = cellSize * 0.8;   // inner rounding

    // Outer frame — draw as filled rounded rect then cut out middle
    eyePaths.push(`<rect x="${ox}" y="${oy}" width="${outer}" height="${outer}" rx="${ro}" ry="${ro}" fill="${QR_COLOR}"/>`);
    eyePaths.push(`<rect x="${ox + cellSize}" y="${oy + cellSize}" width="${mid}" height="${mid}" rx="${rm}" ry="${rm}" fill="${BG_COLOR}"/>`);
    // Inner center dot
    eyePaths.push(`<rect x="${ox + 2 * cellSize}" y="${oy + 2 * cellSize}" width="${inner}" height="${inner}" rx="${ri}" ry="${ri}" fill="${QR_COLOR}"/>`);
  }

  // ── Logo in center ────────────────────────────
  const logoRaw = fs.readFileSync(LOGO_PATH);
  const logoB64 = logoRaw.toString('base64');
  const logoSize = qrPx * 0.24;
  const pad = 6;
  const cx = size / 2;
  const cy = size / 2;

  // ── Assemble SVG ──────────────────────────────
  let svg = '';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="${BG_COLOR}"/>`;

  // Data dots as one merged path (efficient)
  svg += `<path d="${paths.join(' ')}" fill="${QR_COLOR}"/>`;

  // Finder eyes
  svg += eyePaths.join('');

  // Logo white circle bg
  svg += `<circle cx="${cx}" cy="${cy}" r="${logoSize / 2 + pad}" fill="${BG_COLOR}"/>`;
  // Clip to circle
  svg += `<defs><clipPath id="lc"><circle cx="${cx}" cy="${cy}" r="${logoSize / 2}"/></clipPath></defs>`;
  svg += `<image href="data:image/jpeg;base64,${logoB64}" x="${cx - logoSize / 2}" y="${cy - logoSize / 2}" width="${logoSize}" height="${logoSize}" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`;

  svg += '</svg>';
  return svg;
}

/**
 * Generate a branded QR code matching the reference style:
 * - Connected rounded modules (smooth bars with rounded endpoints)
 * - Rounded square finder pattern eyes
 * - BGL logo centered in a circle
 * - Dark navy (#1B2D5B) color scheme
 */
async function generateQR(url) {
  try {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const svg = buildSVG(qr.modules, 12, 48);
    const base64 = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error('QR Code generation failed:', err);
    throw err;
  }
}

module.exports = { generateQR };
