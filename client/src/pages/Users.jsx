import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { useToast } from '../useToast';
import { useConfirm } from '../useConfirm';

export default function Users() {
  const { user, isAdmin, isDirector, canManageUsers, refreshDemoUsers, authFetch } = useAuth();
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

      showToast(`Đã cập nhật vai trò người dùng thành công!`, 'success');
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
        return { label: 'Admin (Quản trị)', bg: '#450a0a', color: '#f87171', border: '#dc2626', icon: '🛡️' };
      case 'director':
        return { label: 'Giám đốc Nhà máy', bg: '#431407', color: '#fb923c', border: '#ea580c', icon: '👔' };
      case 'manager':
        return { label: 'Quản đốc Xưởng', bg: '#451a03', color: '#fbbf24', border: '#d97706', icon: '🏭' };
      case 'shift_leader':
        return { label: 'Trưởng ca Sản xuất', bg: '#422006', color: '#fde047', border: '#ca8a04', icon: '⏱️' };
      case 'supervisor':
        return { label: 'Giám sát Sản xuất', bg: '#082f49', color: '#38bdf8', border: '#0284c7', icon: '🔍' };
      case 'qc':
        return { label: 'QC / KCS', bg: '#164e63', color: '#22d3ee', border: '#06b6d4', icon: '🎯' };
      case 'technician':
        return { label: 'Kỹ thuật viên', bg: '#2e1065', color: '#c084fc', border: '#8b5cf6', icon: '🔧' };
      case 'operator':
        return { label: 'Nhân viên Vận hành', bg: '#064e3b', color: '#34d399', border: '#059669', icon: '🖨️' };
      case 'post_processing':
        return { label: 'Nhân viên Hậu kỳ', bg: '#500724', color: '#f472b6', border: '#ec4899', icon: '🎨' };
      case 'viewer':
      default:
        return { label: 'Viewer (Chỉ xem)', bg: '#1e293b', color: '#94a3b8', border: '#475569', icon: '👁️' };
    }
  };

  return (
    <div>
      {confirmModal}
      {toastEl}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0', color: '#f8fafc' }}>
          3D Vincons Window — Quản lý Nhân sự & Phân quyền Xưởng (RBAC)
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
          Hệ thống phân cấp 10 bậc nhân sự: Quản trị, Giám đốc, Quản đốc, Trưởng ca, Giám sát, QC, Kỹ thuật, Vận hành, Hậu kỳ và Giám sát chỉ xem.
        </p>
      </div>

      {!canManageUsers && (
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
            Bạn đang đăng nhập với quyền <strong>{user?.role?.toUpperCase()}</strong>. Chỉ <strong>Admin</strong> hoặc <strong>Giám đốc Nhà máy</strong> mới có quyền tạo tài khoản hoặc phân quyền người dùng.
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
                {isAdmin && <option value="admin">🛡️ Admin — Quản trị viên cao nhất</option>}
                <option value="director">👔 Giám đốc Nhà máy — Toàn quyền điều hành (dưới Admin)</option>
                <option value="manager">🏭 Quản đốc Xưởng — Kỹ thuật & Giám sát vận hành</option>
                <option value="shift_leader">⏱️ Trưởng ca Sản xuất — Điều phối ca & Kỹ thuật</option>
                <option value="supervisor">🔍 Giám sát Sản xuất — Theo dõi máy & tiến độ</option>
                <option value="qc">🎯 QC / KCS — Kiểm định chất lượng & Báo lỗi in</option>
                <option value="technician">🔧 Kỹ thuật viên — Bảo trì máy & Xử lý phần cứng</option>
                <option value="operator">🖨️ Nhân viên Vận hành — Set Ready, nạp nhựa & Báo lỗi</option>
                <option value="post_processing">🎨 Nhân viên Hậu kỳ — Xử lý sp & BÁO LỖI IN</option>
                <option value="viewer">👁️ Viewer — Khách / Theo dõi (Chỉ xem)</option>
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
                        {canManageUsers && (!u.role === 'admin' || isAdmin) ? (
                          <select
                            value={u.role}
                            disabled={!isAdmin && u.role === 'admin'}
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
                            {isAdmin && <option value="admin">🛡️ Admin</option>}
                            <option value="director">👔 Giám đốc NM</option>
                            <option value="manager">🏭 Quản đốc</option>
                            <option value="shift_leader">⏱️ Trưởng ca</option>
                            <option value="supervisor">🔍 Giám sát</option>
                            <option value="qc">🎯 QC / KCS</option>
                            <option value="technician">🔧 Kỹ thuật</option>
                            <option value="operator">🖨️ Vận hành</option>
                            <option value="post_processing">🎨 Hậu kỳ</option>
                            <option value="viewer">👁️ Viewer</option>
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
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <span>{b.icon}</span> {b.label}
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

                          {canManageUsers && !isCurrent && (u.role !== 'admin' || isAdmin) && (
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
          3D Vincons Window — Ma trận phân quyền 10 bậc nhân sự (RBAC Matrix)
        </h2>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 16px 0' }}>
          Chi tiết nhiệm vụ, phạm vi quyền hạn và thẩm quyền xử lý theo đúng cơ cấu nhà máy 3D Vincons Window.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {/* Admin Card */}
          <div style={{ background: '#1a1012', border: '1px solid #dc2626', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🛡️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>Admin (Quản trị hệ thống)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Toàn quyền cấu hình, vận hành, bảo mật và quản lý mọi tài khoản trong hệ thống.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Tạo, phân quyền, khóa tài khoản Admin & Giám đốc</li>
              <li>✓ Cấu hình bảo mật, xóa máy in, backup & restore DB</li>
              <li>✓ Toàn quyền vận hành, duyệt in, báo lỗi, sửa chữa</li>
            </ul>
          </div>

          {/* Director Card */}
          <div style={{ background: '#1a1208', border: '1px solid #ea580c', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>👔</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fb923c' }}>Giám đốc Nhà máy (Director)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Quyền cao nhất dưới Admin: Điều hành toàn bộ nhà máy, duyệt sản xuất và nhân sự.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Quản lý danh sách nhân sự (Quản đốc, Trưởng ca, QC,...)</li>
              <li>✓ Theo dõi KPI toàn bộ dàn máy, tiến độ đơn hàng và báo cáo lỗi</li>
              <li>✓ Toàn quyền vận hành máy và phân bổ kế hoạch sản xuất</li>
            </ul>
          </div>

          {/* Manager Card */}
          <div style={{ background: '#191508', border: '1px solid #d97706', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🏭</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>Quản đốc Xưởng (Manager)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Tập hợp quyền Kỹ thuật & Giám sát: Điều hành toàn diện máy in và xử lý sự cố xưởng.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Giám sát luồng in, điều phối máy, duyệt lệnh và nạp gcode</li>
              <li>✓ Đưa máy vào bảo trì (Decommission) và khôi phục (Recommission)</li>
              <li>✓ Xác nhận bản in tốt (Set Ready) & Xử lý báo cáo lỗi từ các bộ phận</li>
            </ul>
          </div>

          {/* Shift Leader Card */}
          <div style={{ background: '#181708', border: '1px solid #ca8a04', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>⏱️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fde047' }}>Trưởng ca Sản xuất (Shift Leader)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Quyền như Quản đốc trong phạm vi ca trực: Đảm bảo sản lượng và xử lý sự cố trong ca.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Điều phối nhân viên vận hành và hậu kỳ trong ca trực</li>
              <li>✓ Xử lý máy in gặp sự cố, gán lệnh in (Link Job), Recommission</li>
              <li>✓ Báo lỗi bản in, nghiệm thu sản phẩm cuối ca</li>
            </ul>
          </div>

          {/* Supervisor Card */}
          <div style={{ background: '#0a1622', border: '1px solid #0284c7', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>Giám sát Sản xuất (Supervisor)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Theo dõi và kiểm soát tiến độ in, nhiệt độ, camera và tình trạng dàn máy theo thời gian thực.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Theo dõi trực quan trạng thái máy, phát hiện máy dừng bất thường</li>
              <li>✓ Có quyền báo lỗi bản in (Bad Print) và tải ảnh lỗi khi phát hiện</li>
              <li>✓ Đôn đốc tiến độ đơn hàng và nhắc nhở giải phóng bàn in</li>
            </ul>
          </div>

          {/* QC / KCS Card */}
          <div style={{ background: '#081a1f', border: '1px solid #06b6d4', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#22d3ee' }}>Nhân viên QC / KCS</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Quyền như Giám sát, chuyên trách kiểm tra chất lượng bản in và phân loại phế phẩm.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Kiểm định kích thước, bề mặt, độ kết dính lớp in</li>
              <li>✓ Báo lỗi bản in & upload ảnh lỗi chi tiết để lưu hồ sơ KCS</li>
              <li>✓ Theo dõi tỷ lệ lỗi theo nguyên nhân (bung bàn, lệch lớp, sợi rối)</li>
            </ul>
          </div>

          {/* Technician Card */}
          <div style={{ background: '#160c24', border: '1px solid #8b5cf6', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🔧</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#c084fc' }}>Nhân viên Kỹ thuật (Technician)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Chuyên trách phần cứng: Bảo trì định kỳ, sửa chữa đầu phun, thay linh kiện máy in.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Đưa máy hỏng vào bảo trì (Decommission) và ghi log kỹ thuật</li>
              <li>✓ Khôi phục máy (Recommission) sau khi sửa chữa xong</li>
              <li>✓ Cân chỉnh bàn in (Z-offset, Bed leveling), test gcode</li>
            </ul>
          </div>

          {/* Operator Card */}
          <div style={{ background: '#0b1d16', border: '1px solid #059669', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🖨️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>Nhân viên Vận hành (Operator)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Trực tiếp đứng xưởng: Nạp nhựa, lấy bản in, làm sạch bàn in và chạy máy.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Xác nhận bàn in sạch & bấm Set Ready bàn giao máy</li>
              <li>✓ Báo lỗi in ngay khi phát hiện rối sợi hoặc bung bàn</li>
              <li>✓ Tải ảnh lỗi bản in trực tiếp từ điện thoại hoặc máy tính</li>
            </ul>
          </div>

          {/* Post Processing Card */}
          <div style={{ background: '#1c0a15', border: '1px solid #ec4899', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>🎨</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f472b6' }}>Nhân viên Hậu kỳ (Post-Processing)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Xử lý sản phẩm sau in: Gỡ support, mài nhám, sơn phủ và ĐẶC BIỆT BÁO LỖI IN.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Phát hiện lỗi ẩn sau khi gỡ support (nứt lớp, biến dạng, khuyết tật)</li>
              <li>✓ Quyền Báo lỗi in & Chụp/Upload ảnh lỗi thực tế ngay lập tức</li>
              <li>✓ Hệ thống tự động hoàn bù sản lượng để farm in bù sản phẩm</li>
            </ul>
          </div>

          {/* Viewer Card */}
          <div style={{ background: '#141824', border: '1px solid #334155', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>👁️</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>Viewer (Khách / Giám sát xem)</span>
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 8 }}>
              Dành cho khách tham quan hoặc đối tác theo dõi tiến độ đơn hàng.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
              <li>✓ Xem dashboard tổng thể và tiến độ sản lượng thời gian thực</li>
              <li>✓ Xem danh sách máy in, xem ảnh sản phẩm và ảnh lỗi</li>
              <li>✗ Bị vô hiệu hóa toàn bộ các nút thao tác can thiệp vận hành</li>
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
