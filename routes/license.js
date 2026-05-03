const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/license/activate
// Called once when user first enters their code
router.post('/activate', (req, res) => {
  const { code, machine_id } = req.body;

  if (!code || !machine_id) {
    return res.status(400).json({ error: 'code and machine_id are required' });
  }

  // Find the license row
  const license = db.prepare('SELECT * FROM licenses WHERE code = ?').get(code);

  if (!license) {
    return res.status(404).json({ error: 'Invalid license code' });
  }

  // Already activated by a different machine
  if (license.activated && license.machine_id !== machine_id) {
    return res.status(403).json({ error: 'Code already used on another device' });
  }

  // Already activated by this same machine — re-issue token (e.g. extension reinstalled)
  if (license.activated && license.machine_id === machine_id) {
    const expiresAt = new Date(license.expires_at);
    if (expiresAt < new Date()) {
      return res.status(403).json({ error: 'License expired' });
    }
    const token = jwt.sign(
      { machine_id, expires_at: license.expires_at },
      process.env.JWT_SECRET,
      { expiresIn: Math.floor((expiresAt - Date.now()) / 1000) }
    );
    return res.json({ token, expires_at: license.expires_at });
  }

  // First activation
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const expiresAtStr = expiresAt.toISOString();

  db.prepare(`
    UPDATE licenses 
    SET activated=1, machine_id=?, activated_at=datetime('now'), expires_at=?
    WHERE code=?
  `).run(machine_id, expiresAtStr, code);

  const token = jwt.sign(
    { machine_id, expires_at: expiresAtStr },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, expires_at: expiresAtStr, message: 'Activated! 30 days of access.' });
});

// POST /api/license/verify  (called on every extension startup)
const authMiddleware = require('../middleware/auth');
router.post('/verify', authMiddleware, (req, res) => {
  // If we get here, the JWT was valid
  res.json({ valid: true, expires_at: req.license.expires_at });
});

module.exports = router;