# Bihar GenNext LAB — Feedback System

QR code-based feedback collection system with an admin dashboard for exporting data as Excel/PDF.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and edit environment config
cp .env.example .env
# Edit .env — set ADMIN_PASSWORD, SESSION_SECRET, BASE_URL

# 3. Start the server
npm start
```

- **Feedback Form:** `http://localhost:3000/`
- **Admin Dashboard:** `http://localhost:3000/admin.html`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_USERNAME` | Yes | Admin login username |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `BASE_URL` | Yes | Public URL (used in QR codes) |
| `PORT` | No | Server port (default: `3000`) |
| `NODE_ENV` | No | `production` or `development` |

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Production Deployment (PM2)

```bash
npm install --production
cp .env.example .env   # configure all variables
pm2 start ecosystem.config.js
pm2 save
```

## Project Structure

```
bgl-feedback/
├── server.js              # Express app entry point
├── ecosystem.config.js    # PM2 production config
├── .env.example           # Environment template
├── middleware/
│   └── auth.js            # Session auth middleware
├── routes/
│   ├── feedback.js        # POST/GET feedback, exports
│   └── admin.js           # Login/logout, QR generation
├── utils/
│   ├── db.js              # SQLite (sql.js) database
│   └── qr.js              # Branded QR code generator
└── public/
    ├── index.html          # Feedback form
    ├── admin.html          # Admin dashboard
    ├── images/logo.jpg     # BGL logo
    ├── css/
    │   ├── style.css       # Form styles (mobile-first)
    │   └── admin.css       # Dashboard styles (mobile-first)
    └── js/
        ├── feedback.js     # Form logic
        └── admin.js        # Dashboard logic
```

## Security

- **Helmet** HTTP security headers (strict CSP)
- **Rate limiting** — 100 req/15min global, 10/15min for submissions
- **Session-based admin auth** with httpOnly/secure cookies
- **Input sanitization** — HTML stripping, length caps, email validation
- **No inline scripts** — fully CSP-compliant
