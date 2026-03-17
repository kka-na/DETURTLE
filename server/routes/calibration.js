const r = require('express').Router();
const db = require('../db/db');

r.get('/:userId', (req, res) => {
  const c = db.prepare('SELECT * FROM calibrations WHERE user_id=? ORDER BY updated_at DESC LIMIT 1').get(req.params.userId);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json({ ...c, good_pose: JSON.parse(c.good_pose), bad_pose: JSON.parse(c.bad_pose) });
});

r.post('/:userId', (req, res) => {
  const { good_pose, bad_pose, camera_label } = req.body;
  db.prepare('DELETE FROM calibrations WHERE user_id=?').run(+req.params.userId);
  const c = db.prepare('INSERT INTO calibrations (user_id,good_pose,bad_pose,camera_label) VALUES (?,?,?,?) RETURNING *')
    .get(req.params.userId, JSON.stringify(good_pose), JSON.stringify(bad_pose), camera_label ?? null);
  res.json(c);
});

r.delete('/:userId', (req, res) => {
  db.prepare('DELETE FROM calibrations WHERE user_id=?').run(+req.params.userId);
  res.json({ ok: true });
});

module.exports = r;
