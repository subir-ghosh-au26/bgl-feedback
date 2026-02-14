// ═══════════════════════════════════════════════
//  BGL Admin Dashboard — Client-side Logic
// ═══════════════════════════════════════════════

let allFeedback = [];

// ── Login ──────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();

    try {
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('dashboard').classList.add('active');
            loadDashboard();
        } else {
            const err = document.getElementById('loginError');
            err.style.display = 'block';
            setTimeout(() => { err.style.display = 'none'; }, 3000);
        }
    } catch (err) {
        showAdminToast('Network error', 'error');
    }
});

// ── Logout ─────────────────────────────────────
async function logout() {
    try {
        await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
}

// ── Load Dashboard Data ────────────────────────
async function loadDashboard() {
    await Promise.all([loadStats(), loadFeedback()]);
}

async function loadStats() {
    try {
        const res = await fetch('/api/feedback/stats');
        const stats = await res.json();

        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statAvg').textContent = stats.avgRating || '0.0';
        document.getElementById('statToday').textContent = stats.today || 0;


    } catch (err) {
        console.error('Failed to load stats:', err);
    }
}

async function loadFeedback() {
    try {
        const res = await fetch('/api/feedback');
        allFeedback = await res.json();
        renderTable(allFeedback);
    } catch (err) {
        console.error('Failed to load feedback:', err);
    }
}

// ── Render Table ───────────────────────────────
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    if (data.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = data.map(item => {
        const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : '—';

        return `
      <tr>
        <td>${item.id}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.email || '—')}</td>
        <td>${escapeHtml(item.phone || '—')}</td>
        <td><span class="category-badge">${escapeHtml(item.category || '—')}</span></td>
        <td>${escapeHtml(item.organisation || '—')}</td>
        <td><span class="rating-stars">${stars}</span></td>
        <td title="${escapeHtml(item.message)}">${escapeHtml(truncate(item.message, 60))}</td>
        <td>${date}</td>
      </tr>
    `;
    }).join('');
}

// ── Filter / Search ────────────────────────────
function filterTable() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('filterCategory').value;
    const rating = document.getElementById('filterRating').value;

    let filtered = allFeedback;

    if (search) {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(search) ||
            (item.email && item.email.toLowerCase().includes(search)) ||
            item.message.toLowerCase().includes(search)
        );
    }

    if (category) {
        filtered = filtered.filter(item => item.category === category);
    }


    if (rating) {
        filtered = filtered.filter(item => item.rating === parseInt(rating));
    }

    renderTable(filtered);
}

// ── Downloads ──────────────────────────────────
function downloadExcel() {
    showAdminToast('Downloading Excel...', 'success');
    window.location.href = '/api/feedback/export/excel';
}

function downloadPDF() {
    showAdminToast('Downloading PDF...', 'success');
    window.location.href = '/api/feedback/export/pdf';
}

// ── QR Code Modal ──────────────────────────────
async function showQRModal() {
    try {
        const res = await fetch('/api/admin/qrcode');
        const data = await res.json();

        // Inject raw SVG into container to bypass data-uri image security restrictions
        document.getElementById('qrImageContainer').innerHTML = data.qrCode;
        document.getElementById('qrModal').classList.add('active');
    } catch (err) {
        showAdminToast('Failed to load QR code', 'error');
    }
}

function closeQRModal() {
    document.getElementById('qrModal').classList.remove('active');
}

async function downloadQR() {
    const container = document.getElementById('qrImageContainer');
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Set canvas dimensions based on SVG viewBox or width/height
    canvas.width = 1000;  // High resolution download
    canvas.height = 1000;

    img.onload = () => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'bgl-feedback-qr.png';
        link.href = pngUrl;
        link.click();
        showAdminToast('QR Code downloaded!', 'success');
    };

    // Convert SVG string to data URL for the Image object
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
}

// Close modal on overlay click
document.getElementById('qrModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeQRModal();
});

// ── Utility Functions ──────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '…' : str;
}

function showAdminToast(message, type = 'success') {
    const toast = document.getElementById('adminToast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ── Event Bindings (CSP-compliant, no inline handlers) ──
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('downloadExcelBtn').addEventListener('click', downloadExcel);
document.getElementById('downloadPDFBtn').addEventListener('click', downloadPDF);
document.getElementById('showQRBtn').addEventListener('click', showQRModal);
document.getElementById('downloadQRBtn').addEventListener('click', downloadQR);
document.getElementById('closeQRBtn').addEventListener('click', closeQRModal);
document.getElementById('searchInput').addEventListener('input', filterTable);
document.getElementById('filterCategory').addEventListener('change', filterTable);
document.getElementById('filterRating').addEventListener('change', filterTable);
