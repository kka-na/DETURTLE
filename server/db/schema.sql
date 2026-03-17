CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧑',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calibrations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  good_pose    TEXT NOT NULL,
  bad_pose     TEXT NOT NULL,
  camera_label TEXT,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  score       INTEGER NOT NULL,
  level       INTEGER NOT NULL,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  avg_score  REAL,
  time_good  INTEGER,
  time_bad   INTEGER,
  total_min  INTEGER
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id),
  work_minutes    INTEGER DEFAULT 50,
  break_minutes   INTEGER DEFAULT 10,
  posture_adjust  INTEGER DEFAULT 1,
  os_notification INTEGER DEFAULT 1,
  sound           INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS break_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  work_minutes  INTEGER NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER DEFAULT 0,
  started_at    DATETIME NOT NULL,
  ended_at      DATETIME
);
