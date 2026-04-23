const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/status', (req, res) => {
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

  const now = new Date();
  let expired = false;
  let hoursRemaining = 8;

  if (tenant.plan === 'trial' && tenant.expires_at) {
    const expiresAt = new Date(tenant.expires_at);
    expired = now > expiresAt;
    hoursRemaining = Math.max(0, (expiresAt - now) / (1000 * 60 * 60));
  }

  res.json({
    plan: tenant.plan,
    expired,
    hours_remaining: hoursRemaining,
    is_demo: req.user.is_demo === 1,
    expires_at: tenant.expires_at,
  });
});

module.exports = router;
