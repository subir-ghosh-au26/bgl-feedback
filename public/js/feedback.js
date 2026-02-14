// ═══════════════════════════════════════════════
//  BGL Feedback Form — Client-side Logic
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initStarRating();
    initCharCount();
    initFormSubmit();
});

// ── Animated Background Particles ──────────────
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const colors = ['#6C63FF', '#FF6B9D', '#00C781', '#FFD93D', '#8B83FF'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 6 + 3;
        const color = colors[Math.floor(Math.random() * colors.length)];

        particle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
    `;
        container.appendChild(particle);
    }
}

// ── Star Rating ────────────────────────────────
function initStarRating() {
    const stars = document.querySelectorAll('.star');
    const ratingInput = document.getElementById('rating');

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            ratingInput.value = value;

            stars.forEach(s => {
                const v = parseInt(s.dataset.value);
                s.classList.toggle('active', v <= value);
            });
        });

        star.addEventListener('mouseenter', () => {
            const value = parseInt(star.dataset.value);
            stars.forEach(s => {
                const v = parseInt(s.dataset.value);
                if (v <= value) s.querySelector('svg').style.opacity = '0.8';
            });
        });

        star.addEventListener('mouseleave', () => {
            stars.forEach(s => {
                s.querySelector('svg').style.opacity = '';
            });
        });
    });
}

// ── Character Counter ──────────────────────────
function initCharCount() {
    const messageField = document.getElementById('message');
    const charCount = document.getElementById('charCount');
    if (!messageField || !charCount) return;

    messageField.addEventListener('input', () => {
        const len = messageField.value.length;
        charCount.textContent = len;

        if (len > 450) {
            charCount.style.color = '#FF6B9D';
        } else {
            charCount.style.color = '';
        }

        if (len > 500) {
            messageField.value = messageField.value.substring(0, 500);
            charCount.textContent = 500;
        }
    });
}

// ── Form Submission ────────────────────────────
function initFormSubmit() {
    const form = document.getElementById('feedbackForm');
    const submitBtn = document.getElementById('submitBtn');
    if (!form || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate rating
        const rating = document.getElementById('rating').value;
        if (!rating) {
            showToast('Please select a star rating');
            return;
        }

        // Collect data
        const data = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            category: document.getElementById('category').value,
            organisation: document.getElementById('organisation').value.trim(),
            rating: parseInt(rating),
            message: document.getElementById('message').value.trim()
        };

        // Show loading state
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok && result.success) {
                // Show success screen
                document.getElementById('formCard').style.display = 'none';
                const successCard = document.getElementById('successCard');
                successCard.classList.remove('hidden');
                successCard.style.display = 'block';
            } else {
                showToast(result.error || 'Something went wrong');
            }
        } catch (err) {
            showToast('Network error. Please try again.');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });
}

// ── Reset Form ─────────────────────────────────
function resetForm() {
    const form = document.getElementById('feedbackForm');
    const formCard = document.getElementById('formCard');
    const successCard = document.getElementById('successCard');

    // Reset all form fields
    form.reset();
    document.getElementById('rating').value = '';
    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById('charCount').textContent = '0';

    // Hide success, show form
    successCard.classList.add('hidden');
    successCard.style.display = 'none';
    formCard.style.display = 'block';

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Bind "Submit Another" button
const submitAnotherBtn = document.getElementById('submitAnotherBtn');
if (submitAnotherBtn) {
    submitAnotherBtn.addEventListener('click', resetForm);
}

// ── Toast Notification ─────────────────────────
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
