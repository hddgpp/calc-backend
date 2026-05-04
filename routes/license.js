const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/license/activate
router.post('/activate', (req, res) => {
  const { code, machine_id } = req.body;

  if (!code || !machine_id) {
    return res.status(400).json({ error: 'code and machine_id are required' });
  }

  const license = db.prepare('SELECT * FROM licenses WHERE code = ?').get(code);

  if (!license) {
    return res.status(404).json({ error: 'Invalid license code' });
  }

  // Already activated by a different machine
  if (license.activated && license.machine_id !== machine_id) {
    return res.status(403).json({ error: 'Code already used on another device' });
  }

  // Already activated by this same machine — re-issue token
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

// POST /api/license/verify
const authMiddleware = require('../middleware/auth');
router.post('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, expires_at: req.license.expires_at });
});

// POST /api/license/admin/generate
router.post('/admin/generate', (req, res) => {
  const { admin_key } = req.body;

  if (admin_key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  function makeCode() {
    const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CALC-${seg()}-${seg()}-${seg()}`;
  }

  const code = makeCode();
  const hash = bcrypt.hashSync(code, 10);

  db.prepare('INSERT INTO licenses (code, code_hash) VALUES (?, ?)').run(code, hash);

  res.json({ code });
});

module.exports = router;