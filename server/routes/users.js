const express = require('express');
const { hashPassword } = require('../auth');

module.exports = (db) => {
  const router = express.Router();

  // Roles definition and permission matrix for 3D Vincons Window
  const ROLES_INFO = {
    admin: {
      key: 'admin',
      label: 'Admin (Quản trị hệ thống)',
      description: 'Toàn quyền cao nhất: Cấu hình hệ thống, quản lý máy chủ, sao lưu & khôi phục CSDL, phân quyền tài khoản, thiết lập tham số xưởng in.',
      badge_color: '#dc2626',
      badge_bg: '#450a0a',
      permissions: [
        'manage_system',
        'manage_users',
        'manage_printers',
        'manage_settings',
        'manage_projects',
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
        'export_backup',
      ],
    },
    director: {
      key: 'director',
      label: 'Giám đốc Nhà máy (Director)',
      description: 'Quyền ngay dưới Admin: Toàn quyền điều hành xưởng, xem tất cả báo cáo sản xuất, sản lượng, phế phẩm, quản lý nhân sự các bộ phận (dưới Admin).',
      badge_color: '#ea580c',
      badge_bg: '#431407',
      permissions: [
        'manage_users',
        'manage_printers',
        'manage_projects',
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
        'view_reports',
      ],
    },
    manager: {
      key: 'manager',
      label: 'Quản đốc Xưởng (Manager)',
      description: 'Quyền kết hợp Kỹ thuật + Giám sát: Điều phối máy in, xử lý sự cố, khôi phục máy (recommission), giám sát tiến độ thực tế, duyệt lệnh in.',
      badge_color: '#d97706',
      badge_bg: '#451a03',
      permissions: [
        'manage_printers',
        'manage_projects',
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
        'supervise_fleet',
      ],
    },
    shift_leader: {
      key: 'shift_leader',
      label: 'Trưởng ca Sản xuất (Shift Leader)',
      description: 'Giống Quản đốc (Kỹ thuật + Giám sát trong ca trực): Điều hành máy in trong ca, xử lý kỹ thuật, giải phóng bàn in, duyệt in, báo lỗi.',
      badge_color: '#ca8a04',
      badge_bg: '#422006',
      permissions: [
        'manage_printers',
        'dispatch_jobs',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
        'supervise_fleet',
      ],
    },
    supervisor: {
      key: 'supervisor',
      label: 'Giám sát Sản xuất (Supervisor)',
      description: 'Theo dõi và giám sát toàn bộ hoạt động của xưởng in: Tiến độ thời gian thực, hàng đợi lệnh in, lịch sử máy in và camera.',
      badge_color: '#0284c7',
      badge_bg: '#082f49',
      permissions: [
        'view_all',
        'supervise_fleet',
        'view_reports',
        'mark_bad_print',
        'upload_failure_photo',
      ],
    },
    qc: {
      key: 'qc',
      label: 'Nhân viên QC / KCS (Quality Control)',
      description: 'Quyền giống Giám sát: Kiểm soát chất lượng thành phẩm, nghiệm thu bản in, và có quyền Báo lỗi in & upload ảnh bằng chứng.',
      badge_color: '#06b6d4',
      badge_bg: '#164e63',
      permissions: [
        'view_all',
        'supervise_fleet',
        'mark_bad_print',
        'upload_failure_photo',
        'verify_quality',
      ],
    },
    technician: {
      key: 'technician',
      label: 'Nhân viên Kỹ thuật (Technician)',
      description: 'Bảo trì, sửa chữa máy in, thay thế linh kiện, cân chỉnh bàn in, đưa máy vào bảo trì (Decommission) và khôi phục (Recommission).',
      badge_color: '#8b5cf6',
      badge_bg: '#2e1065',
      permissions: [
        'manage_printers',
        'recommission_printers',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
      ],
    },
    operator: {
      key: 'operator',
      label: 'Nhân viên Vận hành (Operator)',
      description: 'Vận hành sản xuất trực tiếp: Xác nhận bàn in sạch (Set Ready), nạp nhựa, khởi chạy in, báo cáo bản in hỏng & upload ảnh lỗi.',
      badge_color: '#10b981',
      badge_bg: '#064e3b',
      permissions: [
        'dispatch_jobs',
        'upload_gcode',
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
      ],
    },
    post_processing: {
      key: 'post_processing',
      label: 'Nhân viên Hậu kỳ (Post-Processing)',
      description: 'Tiếp nhận sản phẩm in: Gỡ support, mài, đánh bóng, sấy nhiệt, hoàn thiện và ĐẶC BIỆT CÓ QUYỀN BÁO LỖI IN & UPLOAD ẢNH LỖI.',
      badge_color: '#ec4899',
      badge_bg: '#500724',
      permissions: [
        'mark_bad_print',
        'upload_failure_photo',
        'view_all',
      ],
    },
    viewer: {
      key: 'viewer',
      label: 'Viewer (Chỉ xem / Khách)',
      description: 'Chỉ xem trạng thái tổng quan: Theo dõi dashboard, danh sách máy in và tiến độ đơn hàng, không thể thực hiện thao tác can thiệp.',
      badge_color: '#64748b',
      badge_bg: '#1e293b',
      permissions: [
        'view_all',
      ],
    },
  };

  const VALID_ROLES = Object.keys(ROLES_INFO);

  // GET /api/users/roles-info
  router.get('/roles-info', (_req, res) => {
    res.json(ROLES_INFO);
  });

  // GET /api/users — list all users
  router.get('/', (req, res) => {
    const users = db.prepare(`
      SELECT id, username, role, display_name, email, is_active, created_at, last_login_at
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
        END, created_at ASC
    `).all();

    res.json(users);
  });

  // Helper to check user management rights
  function canUserManageAccounts(currentUser) {
    if (!currentUser) return true; // Single-user or unauthenticated demo mode fallback
    return currentUser.role === 'admin' || currentUser.role === 'director';
  }

  // POST /api/users — create new user (by Admin or Director)
  router.post('/', (req, res) => {
    if (!canUserManageAccounts(req.user)) {
      return res.status(403).json({ error: 'Chỉ Admin hoặc Giám đốc nhà máy mới có quyền tạo tài khoản người dùng' });
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

    // Director cannot create an Admin account
    if (req.user && req.user.role === 'director' && role === 'admin') {
      return res.status(403).json({ error: 'Giám đốc không thể tạo tài khoản Admin tối cao' });
    }

    const chosenRole = VALID_ROLES.includes(role) ? role : 'operator';

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
    if (!canUserManageAccounts(req.user)) {
      return res.status(403).json({ error: 'Chỉ Admin hoặc Giám đốc nhà máy mới có quyền sửa thông tin người dùng' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    const { role, is_active, display_name, email, password } = req.body || {};

    // Director cannot modify an Admin account, nor promote any account to Admin
    if (req.user && req.user.role === 'director') {
      if (user.role === 'admin') {
        return res.status(403).json({ error: 'Giám đốc không có quyền sửa tài khoản Quản trị viên (Admin)' });
      }
      if (role === 'admin') {
        return res.status(403).json({ error: 'Chỉ Admin mới có quyền cấp vai trò Admin' });
      }
    }

    // Don't deactivate the last active admin
    if (user.role === 'admin' && (is_active === 0 || (role && role !== 'admin'))) {
      const activeAdminCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?").get(user.id)?.c || 0;
      if (activeAdminCount === 0) {
        return res.status(400).json({ error: 'Hệ thống cần tối thiểu một tài khoản Admin đang hoạt động' });
      }
    }

    const updates = [];
    const params = [];

    if (role && VALID_ROLES.includes(role)) {
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
    if (!canUserManageAccounts(req.user)) {
      return res.status(403).json({ error: 'Chỉ Admin hoặc Giám đốc nhà máy mới có quyền xóa người dùng' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (req.user && req.user.id === user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản của chính bạn' });
    }

    // Director cannot delete an Admin account
    if (req.user && req.user.role === 'director' && user.role === 'admin') {
      return res.status(403).json({ error: 'Giám đốc không có quyền xóa tài khoản Admin' });
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
