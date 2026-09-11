const express = require('express');
const { hashPassword } = require('../auth');

module.exports = (db) => {
  const router = express.Router();

  // Roles definition and permission matrix
  const ROLES_INFO = {
    admin: {
      key: 'admin',
      label: 'Admin (Quản trị viên)',
      description: 'Toàn quyền quản trị hệ thống: Thêm/sửa/xóa máy in, phân quyền người dùng, cấu hình nông trại in, sao lưu/khôi phục dữ liệu, duyệt và xóa dự án.',
      permissions: [
        'manage_users',
        'manage_printers',
        'manage_settings',
        'manage_projects',
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'view_all',
      ],
    },
    operator: {
      key: 'operator',
      label: 'Operator (Kỹ thuật viên vận hành)',
      description: 'Vận hành sản xuất: Xác nhận máy in sẵn sàng (Set Ready), báo cáo bản in lỗi kèm upload ảnh lỗi (Bad Print), tạm dừng/tiếp tục, nạp gcode, phân phối lệnh in.',
      permissions: [
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'view_all',
      ],
    },
    viewer: {
      key: 'viewer',
      label: 'Viewer (Người xem / Giám sát)',
      description: 'Chỉ xem trạng thái: Giám sát dashboard, theo dõi đội máy in, xem danh sách jobs và ảnh lỗi, không được thực hiện các thao tác can thiệp phần cứng.',
      permissions: [
        'view_all',
      ],
    },
  };

  // GET /api/users/roles-info
  router.get('/roles-info', (_req, res) => {
    res.json(ROLES_INFO);
  });

  // GET /api/users — list all users
  router.get('/', (req, res) => {
    const users = db.prepare(`
      SELECT id, username, role, display_name, email, is_active, created_at, last_login_at
      FROM users
      ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'operator' THEN 2 ELSE 3 END, created_at ASC
    `).all();

    res.json(users);
  });

  // POST /api/users — create new user (by Admin)
  router.post('/', (req, res) => {
    // Check permission if authenticated
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền tạo tài khoản người dùng' });
    }

    const { username, password, role = 'operator', display_name, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự' });
    }

    const validRoles = ['admin', 'operator', 'viewer'];
    const chosenRole = validRoles.includes(role) ? role : 'operator';

    const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(trimmedUser);
    if (existing) {
      return res.status(409).json({ error: `Tên người dùng "${trimmedUser}" đã tồn tại` });
    }

    const { hash, salt } = hashPassword(password);
    const now = Date.now();

    const result = db.prepare(`
      INSERT INTO users (username, password_hash, salt, role, display_name, email, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      trimmedUser,
      hash,
      salt,
      chosenRole,
      display_name ? display_name.trim() : trimmedUser,
      email ? email.trim() : null,
      now
    );

    const newUser = db.prepare(`
      SELECT id, username, role, display_name, email, is_active, created_at, last_login_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newUser);
  });

  // PUT /api/users/:id — update user role, status, or details
  router.put('/:id', (req, res) => {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền sửa phân quyền người dùng' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const { role, is_active, display_name, email, password } = req.body || {};

    // Don't deactivate the last active admin
    if (user.role === 'admin' && (is_active === 0 || (role && role !== 'admin'))) {
      const activeAdminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?").get(user.id)?.c || 0;
      if (activeAdminCount === 0) {
        return res.status(400).json({ error: 'Hệ thống cần tối thiểu một tài khoản Admin đang hoạt động' });
      }
    }

    const updates = [];
    const params = [];

    if (role && ['admin', 'operator', 'viewer'].includes(role)) {
      updates.push('role = ?');
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (display_name !== undefined) {
      updates.push('display_name = ?');
      params.push(display_name.trim());
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email ? email.trim() : null);
    }
    if (password && password.trim().length >= 4) {
      const { hash, salt } = hashPassword(password.trim());
      updates.push('password_hash = ?', 'salt = ?');
      params.push(hash, salt);
    }

    if (updates.length > 0) {
      params.push(user.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare(`
      SELECT id, username, role, display_name, email, is_active, created_at, last_login_at
      FROM users WHERE id = ?
    `).get(user.id);

    res.json(updated);
  });

  // DELETE /api/users/:id — delete user
  router.delete('/:id', (req, res) => {
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ Admin mới có quyền xóa người dùng' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (req.user && req.user.id === user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính bạn' });
    }

    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND id != ?").get(user.id)?.c || 0;
      if (adminCount === 0) {
        return res.status(400).json({ error: 'Không thể xóa Admin cuối cùng của hệ thống' });
      }
    }

    db.prepare('DELETE FROM user_tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    res.json({ ok: true, message: `Đã xóa người dùng ${user.username}` });
  });

  return router;
};
