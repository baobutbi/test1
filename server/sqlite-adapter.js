const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let SQL = null;
let sqlPromise = null;

function getSqlJs() {
  if (SQL) return Promise.resolve(SQL);
  if (!sqlPromise) {
    sqlPromise = initSqlJs().then((s) => {
      SQL = s;
      return SQL;
    });
  }
  return sqlPromise;
}

class Database {
  constructor(filename, options = {}) {
    this.filename = filename;
    this.options = options;
    if (!SQL) {
      throw new Error('SQL.js must be initialized before creating a Database instance. Await getSqlJs() first.');
    }
    if (filename && filename !== ':memory:' && fs.existsSync(filename)) {
      const buf = fs.readFileSync(filename);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }
  }

  save() {
    if (this.filename && this.filename !== ':memory:') {
      try {
        const data = this.db.export();
        fs.writeFileSync(this.filename, Buffer.from(data));
      } catch (err) {
        console.error('[sqlite-adapter] Failed to persist db to disk:', err.message);
      }
    }
  }

  pragma(cmd) {
    try {
      this.db.exec('PRAGMA ' + cmd);
    } catch (_) {}
  }

  exec(sql) {
    this.db.exec(sql);
    this.save();
    return this;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        const normalize = (p) => (p === undefined ? null : p);
        const flatParams = (params.length === 1 && Array.isArray(params[0]) ? params[0] : params).map(normalize);
        self.db.run(sql, flatParams);
        const res = self.db.exec('SELECT last_insert_rowid() AS id, changes() AS ch;');
        let lastInsertRowid = 0;
        let changes = 0;
        if (res && res[0] && res[0].values && res[0].values[0]) {
          lastInsertRowid = res[0].values[0][0];
          changes = res[0].values[0][1];
        }
        self.save();
        return { changes, lastInsertRowid };
      },
      get(...params) {
        const normalize = (p) => (p === undefined ? null : p);
        const flatParams = (params.length === 1 && Array.isArray(params[0]) ? params[0] : params).map(normalize);
        const stmt = self.db.prepare(sql);
        stmt.bind(flatParams);
        let row = undefined;
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
        stmt.free();
        return row;
      },
      all(...params) {
        const normalize = (p) => (p === undefined ? null : p);
        const flatParams = (params.length === 1 && Array.isArray(params[0]) ? params[0] : params).map(normalize);
        const stmt = self.db.prepare(sql);
        stmt.bind(flatParams);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      }
    };
  }

  transaction(fn) {
    return (...args) => {
      this.exec('BEGIN TRANSACTION');
      try {
        const res = fn(...args);
        this.exec('COMMIT');
        return res;
      } catch (err) {
        this.exec('ROLLBACK');
        throw err;
      }
    };
  }

  async backup(dest) {
    const data = this.db.export();
    fs.writeFileSync(dest, Buffer.from(data));
  }

  close() {
    this.save();
    this.db.close();
  }
}

module.exports = { getSqlJs, Database };
