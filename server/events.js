// Persistent printer event log — records decommission, recommission, job outcomes,
// and freeform operator notes. Events are never deleted.
// No FK constraint on printer_id — history survives printer deletion.

const db = require('./db');

let _insert = null;

function insert(printerId, eventType, note = null, photoUrl = null, username = null) {
  if (!_insert) {
    _insert = db.prepare(
      'INSERT INTO printer_events (printer_id, event_type, note, photo_url, username, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
  }
  _insert.run(printerId, eventType, note ?? null, photoUrl ?? null, username ?? null, Date.now());
}

module.exports = { insert };
