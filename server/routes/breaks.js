const r = require('express').Router();
const db = require('../db/db');

r.post('/', (req, res) => {
  const { user_id, work_minutes, skipped, started_at } = req.body;
  const b = db.prepare('INSERT INTO break_logs (user_id,work_minutes,break_minutes,skipped,started_at) VALUES (?,?,0,?,?) RETURNING *')
    .get(user_id, work_minutes, skipped ? 1 : 0, started_at || new Date().toISOString());
  res.json(b);
});

r.get('/:userId', (req, res) => {
  res.json(db.prepare('SELECT * FROM break_logs WHERE user_id=? AND date(started_at)=? ORDER BY started_at')
    .all(req.params.userId, req.query.date));
});

module.exports = r;
