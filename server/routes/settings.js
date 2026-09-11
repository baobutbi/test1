const express = require('express');
const router = express.Router();

const ALLOWED_KEYS = new Set(['dispatch_batch_size', 'farm_name']);

module.exports = (db) => {
  // GET /api/settings — returns all settings as { key: value, ... }
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    rows.forEach(r => { result[r.key] = r.value; });
    res.json(result);
  });

  // PUT /api/settings/:key — update a single setting value
  router.put('/:key', (req, res) => {
    const { key } = req.params;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: `Unknown setting key: ${key}` });
    }
    const { value } = req.body;
    if (value === undefined || value === null || String(value).trim() === '') {
      return res.status(400).json({ error: 'value is required' });
    }

    if (key === 'dispatch_batch_size') {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 100) {
        return res.status(400).json({ error: 'dispatch_batch_size must be an integer between 1 and 100' });
      }
    }

    if (key === 'farm_name' && String(value).trim().length > 40) {
      return res.status(400).json({ error: 'farm_name must be 40 characters or fewer' });
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    res.json({ key, value: String(value) });
  });

  // POST /api/settings/clear-demo — clear all demo printers and jobs to start with a clean farm
  router.post('/clear-demo', (req, res) => {
    try {
      db.prepare('DELETE FROM jobs').run();
      db.prepare('DELETE FROM parts').run();
      db.prepare('DELETE FROM gcodes').run();
      db.prepare('DELETE FROM projects').run();
      db.prepare('DELETE FROM printer_events').run();
      db.prepare('DELETE FROM printers').run();
      res.json({ ok: true, message: 'Đã xóa toàn bộ máy in và dữ liệu mẫu thành công' });
    } catch (err) {
      res.status(500).json({ error: `Lỗi khi xóa dữ liệu: ${err.message}` });
    }
  });

  // POST /api/settings/load-demo — reload demo fleet
  router.post('/load-demo', (req, res) => {
    try {
      const { seedDemo } = require('../seed-demo');
      seedDemo(db);
      res.json({ ok: true, message: 'Đã nạp lại dữ liệu mẫu thành công' });
    } catch (err) {
      res.status(500).json({ error: `Lỗi khi nạp dữ liệu mẫu: ${err.message}` });
    }
  });

  return router;
};
