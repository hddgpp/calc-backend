require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
app.set('trust proxy', 1);

// Only allow requests from your Chrome extension
// Chrome extensions send Origin: chrome-extension://YOUR_EXTENSION_ID
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '10kb' }));

// Rate limiting — 20 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

// Stricter limit on activation (prevent brute-force guessing codes)
const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many activation attempts' }
});
app.use('/api/license/activate', activateLimiter);

// Routes
app.use('/api/license', require('./routes/license'));
app.use('/api/calculate', require('./routes/calculate'));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Don't leak error details to clients
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));