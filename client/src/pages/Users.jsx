import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { useToast } from '../useToast';
import { useConfirm } from '../useConfirm';

export default function Users() {
  const { user, isAdmin, refreshDemoUsers, authFetch } = useAuth();
  const [showToast, toastEl] = useToast();
  const [confirm, confirmModal] = useConfirm();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rolesInfo, setRolesInfo] = useState({});

  // New user form state
  const [form, setForm] = useState({
    username: '',
    password: '',
    display_name: '',
    email: '',
    role: 'operator',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/users/roles-info'),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (rRes.ok) setRolesInfo(await rRes.json());
    } catch (err) {
      showToast(`Lỗi khi tải danh sách người dùng: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, showToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo người dùng thất bại');

      showToast(`Đã tạo tài khoản "${data.username}" thành công!`, 'success');
      setForm({ username: '', password: '', display_name: '', email: '', role: 'operator' });
      fetchUsers();
      refreshDemoUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật quyền thất bại');

      showToast(`Đã đổi vai trò sang "${newRole.toUpperCase()}"`, 'success');
      fetchUsers();
      refreshDemoUsers();
    } catch (err) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const handleStatusToggle = async (targetUser) => {
    const nextStatus = targetUser.is_active === 1 ? 0 : 1;
    try {
      const res = await authFetch(`/api/users/${targetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật trạng thái thất bại');

      showToast(nextStatus === 1 ? 'Đã kích hoạt tài khoản' : 'Đã tạm khóa tài khoản', 'success');
      fetchUsers();
      refreshDemoUsers();
    } catch (err) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetModalUser || !newPassword.trim()) return;
    setResetting(true);
    try {
      const res = await authFetch(`/api/users/${resetModalUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đổi mật khẩu thất bại');

      showToast(`Đã đổi mật khẩu cho ${resetModalUser.username}`, 'success');
      setResetModalUser(null);
      setNewPassword('');
    } catch (err) {
      showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const ok = await confirm({
      title: `Xóa tài khoản ${targetUser.username}?`,
      message: `Bạn có chắc chắn muốn xóa tài khoản "${targetUser.display_name || targetUser.username}" không? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa tài khoản',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await authFetch(`/api/users/${targetUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xóa tài khoản thất bại');

      showToast(`Đã xóa tài khoản ${targetUser.username}`, 'success');
      fetchUsers();
      refreshDemoUsers();
    } catch (err) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const roleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin (Quản trị)', bg: '#451a03', color: '#f59e0b', border: '#b45309' };
      case 'operator':
        return { label: 'Operator (Vận hành)', bg: '#064e3b', color: '#34d399', border: '#059669' };
      case 'viewer':
      default:
        return { label: 'Viewer (Chỉ xem)', bg: '#1e293b', color: '#94a3b8', border: '#475569' };
    }
  };

  return (
    <div>
      {confirmModal}
      {toastEl}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
          Quản lý Tài khoản & Phân quyền (Users & RBAC)
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Quản lý danh sách người dùng, tạo tài khoản mới và thiết lập phân quyền (Admin, Operator, Viewer).
        </p>
      </div>

      {!isAdmin && (
        <div
          style={{
            background: '#1e293b',
            border: '1px solid #3b82f6',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <div style={{ fontSize: 13, color: '#e2e8f0' }}>
            Bạn đang đăng nhập với quyền <strong>{user?.role?.toUpperCase()}</strong>. Để tạo tài khoản hoặc phân quyền người dùng khác, bạn có thể chuyển sang vai trò <strong>Admin</strong> ở thanh trên/bên.
          </div>
        </div>
      )}

      {/* Grid: Form Tạo tài khoản & Danh sách người dùng */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: 20, marginBottom: 28 }}>
        {/* Create Account Box */}
        <div
          style={{
            background: '#131720',
            border: '1px solid #1e2433',
            borderRadius: 8,
            padding: '18px 20px',
            height: 'fit-content',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px 0' }}>
            + Tạo tài khoản mới
          </h2>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            Thêm người dùng mới vào hệ thống quản lý in
          </div>

          {formError && (
            <div
              style={{
                background: '#7f1d1d',
                color: '#fca5a5',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Tên đăng nhập (Username) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="vd: tuan.operator"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Họ và tên / Tên hiển thị
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="vd: Nguyễn Tuấn"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vd: tuan@printfarm.vn"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Phân quyền (Role) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              >
                <option value="operator">Operator — Kỹ thuật viên vận hành (Set Ready, Báo lỗi ảnh)</option>
                <option value="viewer">Viewer — Người xem / Giám sát (Chỉ xem trạng thái)</option>
                <option value="admin">Admin — Quản trị viên (Toàn quyền hệ thống)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                Mật khẩu ban đầu <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Tối thiểu 4 ký tự"
                style={{
                  width: '100%',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 6,
                background: submitting ? '#1e3a8a' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {submitting ? 'Đang tạo…' : '+ Thêm tài khoản'}
            </button>
          </form>
        </div>

        {/* Users Table */}
        <div
          style={{
            background: '#131720',
            border: '1px solid #1e2433',
            borderRadius: 8,
            padding: '18px 20px',
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 2px 0' }}>
                Danh sách người dùng ({users.length})
              </h2>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Các tài khoản đã được cấp quyền truy cập vào hệ thống
              </div>
            </div>
          </div>

          {loading ? (
            <p style={{ color: '#64748b' }}>Đang tải người dùng…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #1e2433' }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Người dùng</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Vai trò (Role)</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Trạng thái</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Đăng nhập cuối</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const b = roleBadge(u.role);
                  const isCurrent = user?.id === u.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid #1a202c', color: '#cbd5e1' }}>
                      <td style={{ padding: '10px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              background: u.role === 'admin' ? '#b45309' : u.role === 'operator' ? '#059669' : '#475569',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          >
                            {(u.display_name || u.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {u.display_name || u.username} {isCurrent && <span style={{ color: '#3b82f6', fontSize: 11 }}>(Bạn)</span>}
                            </div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>@{u.username} {u.email ? `· ${u.email}` : ''}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 10px' }}>
                        {isAdmin ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              background: b.bg,
                              color: b.color,
                              border: `1px solid ${b.border}`,
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              background: b.bg,
                              color: b.color,
                              border: `1px solid ${b.border}`,
                              borderRadius: 4,
                              padding: '2px 8px',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {b.label}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 10px' }}>
                        {u.is_active === 1 ? (
                          <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}>● Hoạt động</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>● Đã khóa</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 10px', color: '#64748b', fontSize: 12 }}>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : 'Chưa đăng nhập'}
                      </td>

                      <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => {
                              setResetModalUser(u);
                              setNewPassword('');
                            }}
                            title="Đổi mật khẩu"
                            style={{
                              background: '#1e293b',
                              border: '1px solid #334155',
                              color: '#94a3b8',
                              borderRadius: 4,
                              padding: '3px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            Đổi mật khẩu
                          </button>

                          {isAdmin && !isCurrent && (
                            <>
                              <button
                                onClick={() => handleStatusToggle(u)}
                                title={u.is_active === 1 ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                                style={{
                                  background: u.is_active === 1 ? '#451a1a' : '#14532d',
                                  border: 'none',
                                  color: u.is_active === 1 ? '#fca5a5' : '#86efac',
                                  borderRadius: 4,
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                {u.is_active === 1 ? 'Khóa' : 'Mở'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                title="Xóa tài khoản"
                                style={{
                                  background: '#7f1d1d',
                                  border: 'none',
                                  color: '#fee2e2',
                                  borderRadius: 4,
                                  padding: '3px 8px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Role Permission Matrix Details */}
      <div
        style={{
          background: '#131720',
          border: '1px solid #1e2433',
          borderRadius: 8,
          padding: '20px 24px',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px 0' }}>
          Ma trận phân quyền hệ thống (RBAC Matrix)
        </h2>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 16px 0' }}>
          So sánh quyền hạn chi tiết giữa các cấp độ tài khoản trong Print Farm Manager.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Admin Card */}
          <div style={{ background: '#1a1824', border: '1px solid #b45309', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>👑</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>Admin (Quản trị viên)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 12 }}>
              Toàn quyền cấu hình, vận hành và quản lý nhân sự trên toàn hệ thống.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
              <li>✓ Tạo, sửa, khóa và phân quyền tài khoản người dùng</li>
              <li>✓ Thêm, cấu hình IP, chỉnh sửa và xóa máy in</li>
              <li>✓ Vận hành in (Set Ready, Báo lỗi bản in & upload ảnh)</li>
              <li>✓ Khôi phục máy in (Recommission) sau khi sửa chữa</li>
              <li>✓ Tạo dự án, upload G-code, phân phối lệnh in</li>
              <li>✓ Quản lý vật liệu, nhóm máy, sao lưu và khôi phục DB</li>
            </ul>
          </div>

          {/* Operator Card */}
          <div style={{ background: '#0e1f1c', border: '1px solid #059669', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>🛠️</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#34d399' }}>Operator (Kỹ thuật viên vận hành)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 12 }}>
              Dành cho kỹ thuật viên tại xưởng in trực tiếp thao tác với máy và bản in.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
              <li>✓ Xác nhận bản in tốt (Set Ready) và bàn giao máy</li>
              <li>✓ Báo lỗi bản in (Bad Print) kèm chụp/upload ảnh lỗi thực tế</li>
              <li>✓ Gắn lệnh in thủ công (Link Job) và khôi phục máy (Recommission)</li>
              <li>✓ Nạp file G-code, theo dõi tiến độ in thời gian thực</li>
              <li>✗ Không thể xóa máy in hoặc thay đổi cài đặt bảo mật trang trại</li>
              <li>✗ Không thể sửa phân quyền hoặc xóa tài khoản người khác</li>
            </ul>
          </div>

          {/* Viewer Card */}
          <div style={{ background: '#141824', border: '1px solid #334155', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>👁️</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>Viewer (Giám sát / Khách)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 12 }}>
              Dành cho quản lý, khách hàng hoặc kiểm toán viên chỉ cần theo dõi tiến độ.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
              <li>✓ Xem dashboard tổng quan, tỷ lệ hoàn thành dự án</li>
              <li>✓ Theo dõi danh sách máy in, nhiệt độ, camera (nếu có)</li>
              <li>✓ Xem danh sách lệnh in và xem ảnh phóng to các bản in lỗi</li>
              <li>✓ Xem lịch sử sự kiện (Event History) của từng máy in</li>
              <li>✗ Khóa toàn bộ các nút thao tác (Set Ready, Báo lỗi, Xóa...)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setResetModalUser(null)}
        >
          <div
            style={{
              background: '#131720',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '20px 24px',
              maxWidth: 380,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
              Đổi mật khẩu — {resetModalUser.username}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px 0' }}>
              Nhập mật khẩu mới cho người dùng này.
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
                  Mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 4 ký tự"
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '7px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={resetting || newPassword.length < 4}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: resetting || newPassword.length < 4 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resetting ? 'Đang lưu…' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
