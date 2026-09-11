const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function seedDefaultUsers(db) {
  try {
    const defaultAccounts = [
      { username: 'admin', pass: 'admin123', role: 'admin', name: 'Quản trị viên Hệ thống', email: 'admin@vincons3d.vn' },
      { username: 'giamdoc', pass: 'giamdoc123', role: 'director', name: 'Giám đốc Nhà máy (3D Vincons)', email: 'director@vincons3d.vn' },
      { username: 'quandoc', pass: 'quandoc123', role: 'manager', name: 'Quản đốc Xưởng In', email: 'manager@vincons3d.vn' },
      { username: 'truongca', pass: 'truongca123', role: 'shift_leader', name: 'Trưởng ca Sản xuất', email: 'shift@vincons3d.vn' },
      { username: 'giamsat', pass: 'giamsat123', role: 'supervisor', name: 'Giám sát Sản xuất', email: 'supervisor@vincons3d.vn' },
      { username: 'qc', pass: 'qc123', role: 'qc', name: 'Nhân viên QC / KCS', email: 'qc@vincons3d.vn' },
      { username: 'kythuat', pass: 'kythuat123', role: 'technician', name: 'Kỹ thuật viên Bảo trì Máy', email: 'tech@vincons3d.vn' },
      { username: 'operator', pass: 'operator123', role: 'operator', name: 'Kỹ thuật viên Vận hành Máy', email: 'operator@vincons3d.vn' },
      { username: 'hauky', pass: 'hauky123', role: 'post_processing', name: 'Nhân viên Xử lý Hậu kỳ', email: 'finishing@vincons3d.vn' },
      { username: 'viewer', pass: 'viewer123', role: 'viewer', name: 'Khách / Giám sát xem', email: 'viewer@vincons3d.vn' },
    ];

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, password_hash, salt, role, display_name, email, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const now = Date.now();
    for (const acc of defaultAccounts) {
      const existing = db.prepare('SELECT id, role, display_name FROM users WHERE username = ? COLLATE NOCASE').get(acc.username);
      if (!existing) {
        const { hash, salt } = hashPassword(acc.pass);
        insertStmt.run(acc.username, hash, salt, acc.role, acc.name, acc.email, now);
      }
    }

    console.log('[auth] Seeded and verified 3D Vincons Window roles and accounts.');
  } catch (err) {
    console.error('[auth] Failed to seed default users:', err.message);
  }
}

function getAuthMiddleware(db) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    let token = null;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    if (!token) {
      // Default to guest/viewer or check if single-user mode, but let's provide user if available
      req.user = null;
      return next();
    }

    try {
      const row = db.prepare(`
        SELECT u.id, u.username, u.role, u.display_name, u.email, u.is_active, t.expires_at
        FROM user_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token = ? AND u.is_active = 1
      `).get(token);

      if (row && row.expires_at > Date.now()) {
        req.user = {
          id: row.id,
          username: row.username,
          role: row.role,
          display_name: row.display_name,
          email: row.email,
        };
      } else {
        req.user = null;
      }
    } catch (err) {
      req.user = null;
    }

    next();
  };
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Permission denied. Requires one of: ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  seedDefaultUsers,
  getAuthMiddleware,
  requireRole,
};
