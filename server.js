require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '10kb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Block non-extension origins on all routes except admin
app.use((req, res, next) => {
  if (req.path.startsWith('/api/license/admin')) {
    return next();
  }
  const origin = req.headers.origin;
  if (origin && origin !== 'chrome-extension://nbmbfahnmdcegnhkephebhopkhlnfion') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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