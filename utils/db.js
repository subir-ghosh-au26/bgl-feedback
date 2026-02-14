const mongoose = require('mongoose');

/**
 * Feedback Schema for MongoDB
 */
const feedbackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    category: { type: String, required: true },
    organisation: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

const Feedback = mongoose.model('Feedback', feedbackSchema, 'feedback');

/**
 * Initialize MongoDB connection using Mongoose.
 */
async function initDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.warn('⚠️ MONGODB_URI is not set. Application might fail if no default local mongo is available.');
    }

    try {
        await mongoose.connect(uri || 'mongodb://localhost:27017/bgl-feedback');
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        throw err;
    }
}

/** Get the Feedback model */
function getFeedbackModel() {
    return Feedback;
}

// No-ops for compatibility with existing route structure if needed
function getDB() { return null; }
function saveDB() { }

module.exports = { initDB, getFeedbackModel, getDB, saveDB };
