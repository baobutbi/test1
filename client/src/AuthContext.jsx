import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('print_farm_token');
  const headers = {
    ...(options.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('print_farm_token'));
  const [demoUsers, setDemoUsers] = useState([]);

  const fetchCurrentUser = useCallback(async (authToken) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        // If no user is logged in, auto-login or set default demo user
        const demoRes = await fetch('/api/auth/demo-users');
        const list = await demoRes.json().catch(() => []);
        setDemoUsers(list);

        // If list exists and no token was set, auto switch to admin for convenient first experience
        if (list.length > 0 && !authToken) {
          const defaultUser = list.find(u => u.role === 'admin') || list[0];
          if (defaultUser) {
            const switchRes = await fetch('/api/auth/switch-demo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: defaultUser.username }),
            });
            const switchData = await switchRes.json();
            if (switchData.ok && switchData.token) {
              localStorage.setItem('print_farm_token', switchData.token);
              setToken(switchData.token);
              setUser(switchData.user);
              return;
            }
          }
        }
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch auth state:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDemoUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/demo-users');
      const list = await res.json();
      setDemoUsers(list);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchCurrentUser(token);
    loadDemoUsers();
  }, [fetchCurrentUser, loadDemoUsers, token]);

  const login = async (username, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      throw new Error(`Không thể kết nối đến máy chủ backend. Vui lòng kiểm tra server backend đã được chạy chưa (${err.message})`);
    }

    let data;
    try {
      data = await res.json();
    } catch (_err) {
      throw new Error(`Máy chủ không phản hồi đúng dữ liệu (${res.status} ${res.statusText}). Vui lòng đảm bảo backend đang chạy đúng cổng.`);
    }

    if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

    localStorage.setItem('print_farm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    loadDemoUsers();
    return data.user;
  };

  const register = async ({ username, password, display_name, email, role }) => {
    let res;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, display_name, email, role }),
      });
    } catch (err) {
      throw new Error(`Không thể kết nối đến máy chủ backend (${err.message})`);
    }

    let data;
    try {
      data = await res.json();
    } catch (_err) {
      throw new Error(`Máy chủ không phản hồi đúng dữ liệu (${res.status} ${res.statusText})`);
    }

    if (!res.ok) throw new Error(data.error || 'Đăng ký tài khoản thất bại');

    localStorage.setItem('print_farm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    loadDemoUsers();
    return data.user;
  };

  const switchDemo = async (username) => {
    let res;
    try {
      res = await fetch('/api/auth/switch-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
    } catch (err) {
      throw new Error(`Không thể kết nối máy chủ (${err.message})`);
    }

    let data;
    try {
      data = await res.json();
    } catch (_err) {
      throw new Error(`Lỗi phản hồi từ máy chủ (${res.status})`);
    }

    if (!res.ok) throw new Error(data.error || 'Chuyển tài khoản thất bại');

    localStorage.setItem('print_farm_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem('print_farm_token');
    setToken(null);
    setUser(null);
  };

  // Factory Role helpers for 3D Vincons Window
  const role = user?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isDirector = role === 'director' || isAdmin;
  const isManager = ['admin', 'director', 'manager', 'shift_leader'].includes(role);
  const isShiftLeader = ['admin', 'director', 'manager', 'shift_leader'].includes(role);
  const isSupervisor = ['admin', 'director', 'manager', 'shift_leader', 'supervisor', 'qc'].includes(role);
  const isQC = ['admin', 'director', 'manager', 'shift_leader', 'supervisor', 'qc'].includes(role);
  const isTechnician = ['admin', 'director', 'manager', 'shift_leader', 'technician'].includes(role);
  const isOperator = ['admin', 'director', 'manager', 'shift_leader', 'technician', 'operator'].includes(role);
  const isPostProcessing = role === 'post_processing';
  const isViewer = role === 'viewer';

  // Permission flags based on factory hierarchy
  // Nhân viên hậu kỳ và QC có toàn quyền Báo lỗi in & upload ảnh
  const canReportFailure = ['admin', 'director', 'manager', 'shift_leader', 'technician', 'supervisor', 'qc', 'operator', 'post_processing'].includes(role);
  // Thao tác vận hành máy: Admin, Giám đốc, Quản đốc, Trưởng ca, Kỹ thuật, Vận hành
  const canOperate = ['admin', 'director', 'manager', 'shift_leader', 'technician', 'operator'].includes(role);
  // Quản lý người dùng: Admin và Giám đốc nhà máy
  const canManageUsers = ['admin', 'director'].includes(role);
  // Quản lý máy in và khôi phục máy bảo trì: Admin, Giám đốc, Quản đốc, Trưởng ca, Kỹ thuật
  const canManagePrinters = ['admin', 'director', 'manager', 'shift_leader', 'technician'].includes(role);
  const canRecommission = ['admin', 'director', 'manager', 'shift_leader', 'technician'].includes(role);
  const canAccessSettings = ['admin', 'director', 'manager'].includes(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        demoUsers,
        login,
        register,
        switchDemo,
        logout,
        role,
        isAdmin,
        isDirector,
        isManager,
        isShiftLeader,
        isSupervisor,
        isQC,
        isTechnician,
        isOperator,
        isPostProcessing,
        isViewer,
        canOperate,
        canReportFailure,
        canManageUsers,
        canManagePrinters,
        canRecommission,
        canAccessSettings,
        authFetch,
        refreshDemoUsers: loadDemoUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
