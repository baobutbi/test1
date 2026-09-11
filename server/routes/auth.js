const express = require('express');
const { hashPassword, verifyPassword, generateToken } = require('../auth');

module.exports = (db) => {
  const router = express.Router();

  // GET /api/auth/me — returns current authenticated user
  router.get('/me', (req, res) => {
    if (!req.user) {
      // In demo mode or if no token sent, return default current state
      const count = db.prepare('SELECT COUNT(*) AS c FROM users').get()?.c || 0;
      return res.json({
        authenticated: false,
        user: null,
        total_users: count,
      });
    }

    res.json({
      authenticated: true,
      user: req.user,
    });
  });

  // GET /api/auth/demo-users — returns list of available users for fast switching in UI
  router.get('/demo-users', (_req, res) => {
    const users = db.prepare(`
      SELECT id, username, role, display_name, email, is_active
      FROM users
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'director' THEN 2 
          WHEN 'manager' THEN 3 
          WHEN 'shift_leader' THEN 4 
          WHEN 'supervisor' THEN 5 
          WHEN 'qc' THEN 6 
          WHEN 'technician' THEN 7 
          WHEN 'operator' THEN 8 
          WHEN 'post_processing' THEN 9 
          ELSE 10 
        END, username ASC
    `).all();
    res.json(users);
  });

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact an admin.' });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

    db.prepare(`
      INSERT INTO user_tokens (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, user.id, now, expiresAt);

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        display_name: user.display_name,
        email: user.email,
      },
    });
  });

  // POST /api/auth/switch-demo — quick login to an existing demo user
  router.post('/switch-demo', (req, res) => {
    const { username } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000);

    db.prepare(`
      INSERT INTO user_tokens (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, user.id, now, expiresAt);

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        display_name: user.display_name,
        email: user.email,
      },
    });
  });

  // POST /api/auth/register — create new account
  router.post('/register', (req, res) => {
    const { username, password, display_name, email, role } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(trimmedUser);
    if (existing) {
      return res.status(409).json({ error: `Username "${trimmedUser}" is already taken` });
    }

    // Role assignment:
    // If registered by an authenticated admin, use requested role.
    // If no admin exists in DB yet, grant admin.
    // Otherwise default to 'operator' or 'viewer'
    const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get()?.c || 0;
    let assignedRole = 'operator';

    const ALL_ROLES = ['admin', 'director', 'manager', 'shift_leader', 'supervisor', 'qc', 'technician', 'operator', 'post_processing', 'viewer'];
    if (adminCount === 0) {
      assignedRole = 'admin';
    } else if (req.user && (req.user.role === 'admin' || req.user.role === 'director') && role) {
      if (req.user.role === 'director' && role === 'admin') {
        assignedRole = 'operator';
      } else {
        assignedRole = ALL_ROLES.includes(role) ? role : 'operator';
      }
    } else if (role && ALL_ROLES.includes(role) && role !== 'admin' && role !== 'director') {
      assignedRole = role;
    }

    const { hash, salt } = hashPassword(password);
    const now = Date.now();

    const insertResult = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, display_name, email, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      trimmedUser,
      hash,
      salt,
      assignedRole,
      display_name ? display_name.trim() : trimmedUser,
      email ? email.trim() : null,
      now
    );

    const newUserId = Number(insertResult.lastInsertRowid);
    const token = generateToken();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000);

    db.prepare(`
      INSERT INTO user_tokens (token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, newUserId, now, expiresAt);

    res.status(201).json({
      ok: true,
      token,
      user: {
        id: newUserId,
        username: trimmedUser,
        role: assignedRole,
        display_name: display_name ? display_name.trim() : trimmedUser,
        email: email ? email.trim() : null,
      },
    });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.headers['x-auth-token'];
    if (token) {
      try {
        db.prepare('DELETE FROM user_tokens WHERE token = ?').run(token);
      } catch (_) {}
    }
    res.json({ ok: true });
  });

  return router;
};
