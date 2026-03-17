const Database = require('better-sqlite3');
const { readFileSync } = require('fs');
const path = require('path');

const db = new Database(path.join(__dirname, 'deturtle.db'));
db.pragma('journal_mode = WAL');
db.exec(readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
