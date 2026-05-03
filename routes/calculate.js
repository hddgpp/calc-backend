const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

function parseNumbers(input) {
  const matches = input.match(/-?\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

// POST /api/calculate  — requires valid JWT
router.post('/', authMiddleware, (req, res) => {
  const { input, machine_id } = req.body;

  // Extra check: token's machine_id must match the request body
  if (req.license.machine_id !== machine_id) {
    return res.status(403).json({ error: 'Machine mismatch' });
  }

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'input is required' });
  }

  if (input.length > 2000) {
    return res.status(400).json({ error: 'Input too long' });
  }

  if (!req.body.ts || Math.abs(Date.now() - req.body.ts) > 30000) {
    return res.status(400).json({ error: 'Request expired' });
  }

  const numbers = parseNumbers(input);

  if (numbers.length === 0) {
    return res.status(400).json({ error: 'No numbers found' });
  }

  const sum = numbers.reduce((a, b) => a + b, 0);
  const product = numbers.reduce((a, b) => a * b, 1);
  const result = product / sum;

  res.json({ result, numbers, sum, product });
});

module.exports = router;