require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

const EXTENSION_ID = 'chrome-extension://nbmbfahnmdcegnhkephebhopkhlnfion';

// Handle CORS and origin lock
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow preflight requests from the extension
  if (req.method === 'OPTIONS') {
    if (!origin || origin.startsWith('chrome-extension://')) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.sendStatus(204);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Skip origin check for admin routes (used from PowerShell)
  if (req.path.startsWith('/api/license/admin')) {
    return next();
  }

  // Block all other origins
  if (origin && origin !== EXTENSION_ID) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (origin === EXTENSION_ID) {
    res.setHeader('Access-Control-Allow-Origin', EXTENSION_ID);
  }

  next();
});

app.use(express.json({ limit: '10kb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Rate limiting — exclude OPTIONS
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skip: (req) => req.method === 'OPTIONS',
  message: { error: 'Too many activation attempts' }
});
app.use('/api/license/activate', activateLimiter);

app.use('/api/license', require('./routes/license'));
app.use('/api/calculate', require('./routes/calculate'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));