const r = require('express').Router();
const db = require('../db/db');

r.post('/', (req, res) => {
  const { user_id, score, level } = req.body;
  const s = db.prepare('INSERT INTO scores (user_id,score,level) VALUES (?,?,?) RETURNING *').get(user_id, score, level);
  res.json(s);
});

r.get('/:userId', (req, res) => {
  const cond = { today: "date(recorded_at)=date('now')", week: "recorded_at>=datetime('now','-7 days')", month: "recorded_at>=datetime('now','-30 days')" };
  const range = req.query.range || 'today';
  res.json(db.prepare(`SELECT * FROM scores WHERE user_id=? AND ${cond[range]} ORDER BY recorded_at`).all(req.params.userId));
});

r.get('/:userId/hourly', (req, res) => {
  res.json(db.prepare(
    `SELECT strftime('%H',recorded_at) hour, ROUND(AVG(score),1) avg_score, ROUND(AVG(level),1) avg_level
     FROM scores WHERE user_id=? AND date(recorded_at)=? GROUP BY hour ORDER BY hour`
  ).all(req.params.userId, req.query.date));
});

module.exports = r;
