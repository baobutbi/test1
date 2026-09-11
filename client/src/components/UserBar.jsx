import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function UserBar({ compact = false }) {
  const { user, demoUsers, switchDemo, logout, login, register } = useAuth();
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '', display_name: '', email: '', role: 'operator' });
  const [authError, setAuthError] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', full: 'Quản trị hệ thống', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: '🛡️' };
      case 'director':
        return { label: 'Giám đốc', full: 'Giám đốc Nhà máy', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: '👔' };
      case 'manager':
        return { label: 'Quản đốc', full: 'Quản đốc Xưởng', bg: '#fefce8', color: '#a16207', border: '#fef08a', icon: '🏭' };
      case 'shift_leader':
        return { label: 'Trưởng ca', full: 'Trưởng ca Sản xuất', bg: '#fef9c3', color: '#854d0e', border: '#fde047', icon: '⏱️' };
      case 'supervisor':
        return { label: 'Giám sát', full: 'Giám sát Sản xuất', bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', icon: '🔍' };
      case 'qc':
        return { label: 'QC / KCS', full: 'Kiểm soát chất lượng', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', icon: '🎯' };
      case 'technician':
        return { label: 'Kỹ thuật', full: 'Kỹ thuật viên Bảo trì', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff', icon: '🔧' };
      case 'operator':
        return { label: 'Vận hành', full: 'Kỹ thuật viên Vận hành', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '🖨️' };
      case 'post_processing':
        return { label: 'Hậu kỳ', full: 'Xử lý Hậu kỳ (Báo lỗi in)', bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8', icon: '🎨' };
      case 'viewer':
      default:
        return { label: 'Chỉ xem', full: 'Khách / Giám sát xem', bg: '#f8fafc', color: '#475569', border: '#cbd5e1', icon: '👁️' };
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      if (isRegisterMode) {
        await register(authForm);
      } else {
        await login(authForm.username, authForm.password);
      }
      setShowAuthModal(false);
      setAuthForm({ username: '', password: '', display_name: '', email: '', role: 'operator' });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const currentBadge = getRoleBadge(user?.role);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Current User Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: compact ? '6px 10px' : '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: compact ? 28 : 34,
              height: compact ? 28 : 34,
              borderRadius: '50%',
              background: currentBadge.bg,
              border: `2px solid ${currentBadge.border}`,
              color: currentBadge.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: compact ? 12 : 14,
              flexShrink: 0,
            }}
          >
            {currentBadge.icon || (user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: compact ? 12 : 13,
                fontWeight: 700,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.display_name || user?.username || 'Chưa đăng nhập'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: currentBadge.bg,
                  color: currentBadge.color,
                  border: `1px solid ${currentBadge.border}`,
                  padding: '1px 5px',
                  borderRadius: 3,
                  textTransform: 'uppercase',
                }}
              >
                {currentBadge.label}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSwitchMenu(!showSwitchMenu)}
          title="Chuyển quyền / Tài khoản"
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#334155',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            cursor: 'pointer',
            flexShrink: 0,
            fontWeight: 600,
          }}
        >
          {showSwitchMenu ? '▲' : '▼ Vai trò'}
        </button>
      </div>

      {/* Role Switcher & Account Dropdown */}
      {showSwitchMenu && (
        <div
          style={{
            position: 'absolute',
            bottom: compact ? 'auto' : '100%',
            top: compact ? '100%' : 'auto',
            left: 0,
            right: 0,
            marginBottom: compact ? 0 : 6,
            marginTop: compact ? 6 : 0,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: 8,
            zIndex: 100,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', padding: '4px 8px', textTransform: 'uppercase' }}>
            Chuyển nhanh vai trò:
          </div>

          {demoUsers.map((u) => {
            const b = getRoleBadge(u.role);
            const isCurrent = user?.username === u.username;
            return (
              <button
                key={u.id}
                onClick={async () => {
                  await switchDemo(u.username);
                  setShowSwitchMenu(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 5,
                  background: isCurrent ? '#fef2f2' : 'transparent',
                  border: isCurrent ? '1px solid #fecaca' : 'none',
                  color: isCurrent ? '#da251d' : '#334155',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 2,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{u.display_name || u.username}</span>
                  <span style={{ color: isCurrent ? '#dc2626' : '#94a3b8', fontSize: 11, marginLeft: 6 }}>
                    (@{u.username})
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    background: b.bg,
                    color: b.color,
                    border: `1px solid ${b.border}`,
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  {b.label}
                </span>
              </button>
            );
          })}

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '6px 0' }} />

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                setShowSwitchMenu(false);
                setIsRegisterMode(false);
                setShowAuthModal(true);
              }}
              style={{
                flex: 1,
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Đăng nhập / Đổi
            </button>
            <button
              onClick={() => {
                setShowSwitchMenu(false);
                setIsRegisterMode(true);
                setShowAuthModal(true);
              }}
              style={{
                flex: 1,
                background: '#da251d',
                color: '#ffffff',
                border: 'none',
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Tạo tài khoản
            </button>
          </div>
        </div>
      )}

      {/* Login / Register Modal */}
      {showAuthModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '24px 28px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🏢
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  {isRegisterMode ? '3D Vincons Window — Tạo tài khoản mới' : '3D Vincons Window — Đăng nhập hệ thống'}
                </h2>
                <div style={{ fontSize: 11, color: '#da251d', fontWeight: 600 }}>Tập đoàn Vingroup • Xưởng In 3D Công nghiệp</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px 0' }}>
              {isRegisterMode
                ? 'Đăng ký tài khoản nhân sự để vận hành hoặc theo dõi hệ thống máy in.'
                : 'Nhập thông tin tài khoản nhân sự của bạn để xác thực.'}
            </p>

            {authError && (
              <div
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#0f172a',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {isRegisterMode && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Họ và tên / Tên hiển thị
                    </label>
                    <input
                      type="text"
                      value={authForm.display_name}
                      onChange={(e) => setAuthForm({ ...authForm, display_name: e.target.value })}
                      placeholder="Nguyễn Văn A"
                      style={{
                        width: '100%',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '8px 10px',
                        color: '#0f172a',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="user@vincons.vingroup.net"
                      style={{
                        width: '100%',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '8px 10px',
                        color: '#0f172a',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Phân quyền (Role)
                    </label>
                    <select
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                      style={{
                        width: '100%',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        padding: '8px 10px',
                        color: '#0f172a',
                        fontSize: 13,
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="operator">🖨️ Nhân viên Vận hành (Set Ready, Báo lỗi)</option>
                      <option value="post_processing">🎨 Nhân viên Hậu kỳ (Xử lý sản phẩm, Báo lỗi in)</option>
                      <option value="qc">🎯 Nhân viên QC / KCS (Kiểm soát chất lượng, Báo lỗi)</option>
                      <option value="technician">🔧 Kỹ thuật viên Bảo trì Máy</option>
                      <option value="supervisor">🔍 Giám sát Sản xuất</option>
                      <option value="shift_leader">⏱️ Trưởng ca Sản xuất (Kỹ thuật + Giám sát)</option>
                      <option value="manager">🏭 Quản đốc Xưởng In (Kỹ thuật + Giám sát)</option>
                      <option value="director">👔 Giám đốc Nhà máy (3D Vincons)</option>
                      <option value="viewer">👁️ Người xem / Khách (Chỉ xem)</option>
                      <option value="admin">🛡️ Quản trị viên Hệ thống (Admin)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#0f172a',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  style={{
                    background: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  style={{
                    background: '#da251d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: authSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {authSubmitting ? 'Đang xử lý…' : isRegisterMode ? 'Tạo tài khoản' : 'Đăng nhập'}
                </button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setAuthError(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#da251d',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 600,
                  }}
                >
                  {isRegisterMode ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Tạo tài khoản mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
