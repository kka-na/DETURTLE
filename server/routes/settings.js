const r = require('express').Router();
const db = require('../db/db');

r.get('/:userId', (req, res) => {
  res.json(db.prepare('SELECT * FROM user_settings WHERE user_id=?').get(req.params.userId)
    ?? { user_id: +req.params.userId, work_minutes: 50, break_minutes: 10, posture_adjust: 1, os_notification: 1, sound: 1 });
});

r.put('/:userId', (req, res) => {
  const uid = +req.params.userId;
  const { work_minutes, break_minutes, posture_adjust, os_notification, sound } = req.body;
  try {
    db.prepare(`INSERT INTO user_settings (user_id,work_minutes,break_minutes,posture_adjust,os_notification,sound) VALUES (?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        work_minutes=excluded.work_minutes, break_minutes=excluded.break_minutes,
        posture_adjust=excluded.posture_adjust, os_notification=excluded.os_notification, sound=excluded.sound`)
      .run(uid, work_minutes, break_minutes, posture_adjust, os_notification, sound);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = r;
