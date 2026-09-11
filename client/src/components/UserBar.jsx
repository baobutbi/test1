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
        return { label: 'Admin', bg: '#451a03', color: '#f59e0b', border: '#b45309' };
      case 'operator':
        return { label: 'Operator', bg: '#064e3b', color: '#34d399', border: '#059669' };
      case 'viewer':
      default:
        return { label: 'Viewer', bg: '#1e293b', color: '#94a3b8', border: '#475569' };
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
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 8,
          padding: compact ? '6px 10px' : '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: compact ? 26 : 32,
              height: compact ? 26 : 32,
              borderRadius: '50%',
              background: user?.role === 'admin' ? '#b45309' : user?.role === 'operator' ? '#059669' : '#475569',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: compact ? 11 : 13,
              flexShrink: 0,
            }}
          >
            {(user?.display_name || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: compact ? 12 : 13,
                fontWeight: 600,
                color: '#e2e8f0',
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
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
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
            background: '#131720',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: 8,
            zIndex: 100,
            boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
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
                  background: isCurrent ? '#1e3a8a' : 'transparent',
                  border: 'none',
                  color: isCurrent ? '#fff' : '#cbd5e1',
                  fontSize: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: 2,
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{u.display_name || u.username}</span>
                  <span style={{ color: isCurrent ? '#93c5fd' : '#64748b', fontSize: 11, marginLeft: 6 }}>
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

          <div style={{ borderTop: '1px solid #1e2433', margin: '6px 0' }} />

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                setShowSwitchMenu(false);
                setIsRegisterMode(false);
                setShowAuthModal(true);
              }}
              style={{
                flex: 1,
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
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
                background: '#14532d',
                color: '#86efac',
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
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            style={{
              background: '#131720',
              border: '1px solid #334155',
              borderRadius: 10,
              padding: '24px 28px',
              maxWidth: 420,
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px 0' }}>
              {isRegisterMode ? 'Tạo tài khoản người dùng mới' : 'Đăng nhập vào Print Farm'}
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px 0' }}>
              {isRegisterMode
                ? 'Đăng ký tài khoản để vận hành hoặc theo dõi hệ thống máy in.'
                : 'Nhập thông tin tài khoản của bạn để xác thực.'}
            </p>

            {authError && (
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
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
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

              {isRegisterMode && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Họ và tên / Tên hiển thị
                    </label>
                    <input
                      type="text"
                      value={authForm.display_name}
                      onChange={(e) => setAuthForm({ ...authForm, display_name: e.target.value })}
                      placeholder="Nguyễn Văn A"
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

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="user@printfarm.vn"
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

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                      Phân quyền (Role)
                    </label>
                    <select
                      value={authForm.role}
                      onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
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
                    >
                      <option value="operator">Operator (Vận hành in & Báo lỗi)</option>
                      <option value="viewer">Viewer (Chỉ xem / Giám sát)</option>
                      <option value="admin">Admin (Toàn quyền quản trị)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
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

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  style={{
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={authSubmitting}
                  style={{
                    background: '#1e40af',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 600,
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
                    color: '#60a5fa',
                    fontSize: 12,
                    cursor: 'pointer',
                    textDecoration: 'underline',
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
