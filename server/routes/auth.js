const r = require('express').Router();
const db = require('../db/db');

r.post('/register', (req, res) => {
  const { username, display_name } = req.body;
  try {
    const user = db.prepare('INSERT INTO users (username,display_name) VALUES (?,?) RETURNING *').get(username, display_name);
    db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(user.id);
    res.json(user);
  } catch { res.status(409).json({ error: 'Username taken' }); }
});

r.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.body.username);
  if (!u) return res.status(404).json({ error: 'Not found' });
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(u.id);
  res.json(u);
});

r.patch('/profile', (req, res) => {
  const { id, avatar_emoji, display_name } = req.body;
  db.prepare('UPDATE users SET avatar_emoji=COALESCE(?,avatar_emoji), display_name=COALESCE(?,display_name) WHERE id=?').run(avatar_emoji ?? null, display_name ?? null, id);
  res.json(db.prepare('SELECT * FROM users WHERE id=?').get(id));
});

r.get('/me', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.query.id);
  u ? res.json(u) : res.status(404).json({ error: 'Not found' });
});

module.exports = r;
