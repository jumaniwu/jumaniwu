const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/status', (req, res) => {
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.tenantId);
  if (!tenant) return res.status(404).json({ error: 'Tenant tidak ditemukan' });

  // Demo accounts never expire
  if (req.user.is_demo === 1) {
    return res.json({ plan: 'trial', expired: false, hours_remaining: 8, is_demo: true, expires_at: null });
  }

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
    is_demo: false,
    expires_at: tenant.expires_at,
  });
});

module.exports = router;
