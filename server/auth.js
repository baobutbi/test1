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
    const countRow = db.prepare('SELECT COUNT(*) AS c FROM users').get();
    if (countRow && countRow.c > 0) return;

    console.log('[auth] Initializing default user accounts (admin, operator, viewer)...');
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, display_name, email, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const now = Date.now();
    const adminAuth = hashPassword('admin123');
    insertUser.run('admin', adminAuth.hash, adminAuth.salt, 'admin', 'Administrator', 'admin@printfarm.local', now);

    const opAuth = hashPassword('operator123');
    insertUser.run('operator', opAuth.hash, opAuth.salt, 'operator', 'Farm Operator', 'operator@printfarm.local', now);

    const viewerAuth = hashPassword('viewer123');
    insertUser.run('viewer', viewerAuth.hash, viewerAuth.salt, 'viewer', 'Fleet Viewer', 'viewer@printfarm.local', now);

    console.log('[auth] Default accounts created: admin/admin123, operator/operator123, viewer/viewer123');
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
