const r = require('express').Router();
const db = require('../db/db');

r.get('/', (req, res) => {
  const cond = {
    today: "date(s.recorded_at,'+9 hours')=date('now','+9 hours')",
    week:  "s.recorded_at>=datetime('now','-7 days')",
    month: "s.recorded_at>=datetime('now','-30 days')",
  };
  const period = req.query.period || 'today';
  const rows = db.prepare(`
    SELECT u.id user_id, u.display_name, u.avatar_emoji,
      ROUND(AVG(s.score),1) avg_score,
      ROUND(AVG(s.score)*0.7 + AVG(CASE WHEN s.level<=2 THEN 1.0 ELSE 0.0 END)*30, 1) rank_score,
      ROUND(AVG(CASE WHEN s.level<=2 THEN 100.0 ELSE 0.0 END),1) time_good_pct
    FROM scores s JOIN users u ON u.id=s.user_id
    WHERE ${cond[period]} GROUP BY s.user_id ORDER BY rank_score DESC
  `).all();
  res.json(rows.map((row, i) => ({ ...row, rank: i + 1 })));
});

module.exports = r;
