const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

router.post('/activate', async (req, res) => {
  const { code, machine_id } = req.body;
  if (!code || !machine_id) {
    return res.status(400).json({ error: 'code and machine_id are required' });
  }
  try {
    const result = await pool.query('SELECT * FROM licenses WHERE code = $1', [code]);
    const license = result.rows[0];

    if (!license) {
      return res.status(404).json({ error: 'Invalid license code' });
    }

    // Code already used — reject no matter what
    if (license.activated) {
      return res.status(403).json({ error: 'This code has already been used' });
    }

    // First and only activation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expiresAtStr = expiresAt.toISOString();

    await pool.query(
      `UPDATE licenses SET activated=1, machine_id=$1, activated_at=now()::text, expires_at=$2 WHERE code=$3`,
      [machine_id, expiresAtStr, code]
    );

    const token = jwt.sign(
      { machine_id, expires_at: expiresAtStr },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, expires_at: expiresAtStr, message: 'Activated! 30 days of access.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const authMiddleware = require('../middleware/auth');

router.post('/verify', authMiddleware, async (req, res) => {
  const { machine_id } = req.body;

  if (req.license.machine_id !== machine_id) {
    return res.status(403).json({ error: 'Machine mismatch' });
  }

  try {
    const result = await pool.query('SELECT * FROM licenses WHERE machine_id = $1', [machine_id]);
    const license = result.rows[0];

    if (!license) {
      return res.status(403).json({ error: 'License not found' });
    }

    const expiresAt = new Date(license.expires_at);
    if (expiresAt < new Date()) {
      return res.status(401).json({ error: 'License expired', expired: true });
    }

    const token = jwt.sign(
      { machine_id, expires_at: license.expires_at },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ valid: true, token, expires_at: license.expires_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin/generate', async (req, res) => {
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
  try {
    await pool.query('INSERT INTO licenses (code, code_hash) VALUES ($1, $2)', [code, hash]);
    res.json({ code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;