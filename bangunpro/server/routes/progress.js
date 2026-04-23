const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/:projectId', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT r.*, p.progress_fisik, p.id as progress_id
    FROM rab_items r
    LEFT JOIN progress_items p ON r.id = p.rab_item_id AND p.project_id = r.project_id
    WHERE r.project_id = ? ORDER BY r.division_id, r.sort_order
  `).all(req.params.projectId);
  res.json(items);
});

router.put('/:projectId/items/:itemId', (req, res) => {
  const db = getDb();
  const { progress_fisik } = req.body;
  const pct = Math.min(100, Math.max(0, parseFloat(progress_fisik) || 0));

  const existing = db.prepare('SELECT * FROM progress_items WHERE project_id = ? AND rab_item_id = ?').get(req.params.projectId, req.params.itemId);
  if (existing) {
    db.prepare('UPDATE progress_items SET progress_fisik = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pct, existing.id);
  } else {
    db.prepare('INSERT INTO progress_items (project_id, rab_item_id, progress_fisik) VALUES (?,?,?)').run(req.params.projectId, req.params.itemId, pct);
  }
  res.json({ success: true, progress_fisik: pct });
});

module.exports = router;
