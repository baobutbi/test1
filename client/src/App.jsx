import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import UserBar from './components/UserBar';
import VingroupLogo, { VingroupEmblem } from './components/VingroupLogo';
import Dashboard from './pages/Dashboard';
import Fleet from './pages/Fleet';
import Printers from './pages/Printers';
import PrinterDetail from './pages/PrinterDetail';
import Projects from './pages/Projects';
import Jobs from './pages/Jobs';
import Settings from './pages/Settings';
import Decommissioned from './pages/Decommissioned';
import Users from './pages/Users';

const NAV_ITEMS = [
  { to: '/',               label: 'Tổng quan (Dashboard)', icon: '📊' },
  { to: '/fleet',          label: 'Hạm đội máy (Fleet)',   icon: '🖨️' },
  { to: '/printers',       label: 'Danh mục Máy in',       icon: '⚙️', end: true },
  { to: '/projects',       label: 'Dự án & Bản in',        icon: '📁' },
  { to: '/jobs',           label: 'Lệnh in (Jobs Queue)',   icon: '📋' },
  { to: '/decommissioned', label: 'Bảo trì / Ngừng dùng',  icon: '🛠️' },
  { to: '/users',          label: 'Nhân sự & Phân quyền',  icon: '👥' },
  { to: '/settings',       label: 'Cài đặt hệ thống',      icon: '🔧' },
];

const navLinkStyle = ({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 12px',
  borderRadius: 6,
  color: isActive ? '#da251d' : '#475569',
  background: isActive ? '#fef2f2' : 'transparent',
  borderLeft: isActive ? '3px solid #da251d' : '3px solid transparent',
  textDecoration: 'none',
  fontWeight: isActive ? 700 : 500,
  fontSize: 13.5,
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
});

export default function App() {
  // Operator-configurable farm name (Settings → Farm Name)
  const [farmName, setFarmName] = useState('3D Vincons Window');
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => { if (data.farm_name) setFarmName(data.farm_name); })
      .catch(() => {});

    // Settings page dispatches this on save so the sidebar/topbar update live,
    // without needing a full page refresh.
    const onFarmNameChanged = (e) => setFarmName(e.detail);
    window.addEventListener('farmNameChanged', onFarmNameChanged);
    return () => window.removeEventListener('farmNameChanged', onFarmNameChanged);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Responsive layout: sidebar on desktop, top nav bar on mobile */}
        <style>{`
          #layout { display: flex; min-height: 100vh; background: #f8fafc; }
          #sidebar {
            width: 240px;
            flex-shrink: 0;
            background: #ffffff;
            border-right: 1px solid #e2e8f0;
            box-shadow: 1px 0 4px rgba(0, 0, 0, 0.03);
            display: flex;
            flex-direction: column;
            padding: 18px 12px;
            gap: 4px;
            justify-content: space-between;
          }
          #topbar {
            display: none;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 10px 14px;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          }
          #main {
            flex: 1;
            padding: 24px 32px;
            overflow-y: auto;
            min-width: 0;
            background: #f8fafc;
          }
          .nav-item:hover {
            background: #f1f5f9;
            color: #0f172a;
          }
          @media (max-width: 600px) {
            #layout { flex-direction: column; }
            #sidebar { display: none; }
            #topbar { display: flex; }
            #main { padding: 16px 14px; }
          }
        `}</style>

        <div id="layout">
          {/* Sidebar (desktop) */}
          <nav id="sidebar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Brand Logo & Title */}
              <div style={{ padding: '0 6px 16px', borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
                <VingroupLogo compact={false} showTagline={true} />
              </div>

              {/* Navigation Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || !!item.end}
                    style={navLinkStyle}
                    className="nav-item"
                  >
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* User & RBAC Switcher Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
              <UserBar />
            </div>
          </nav>

          {/* Top nav bar (mobile) */}
          <nav id="topbar">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <VingroupLogo compact={true} showTagline={false} />
              <div style={{ width: 160 }}>
                <UserBar compact />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/' || !!item.end}
                  style={({ isActive }) => ({
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '5px 9px',
                    borderRadius: 6,
                    color: isActive ? '#da251d' : '#475569',
                    background: isActive ? '#fef2f2' : '#f1f5f9',
                    border: isActive ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                  })}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <main id="main">
            <Routes>
              <Route path="/"                element={<Dashboard />} />
              <Route path="/fleet"           element={<Fleet />} />
              <Route path="/printers"        element={<Printers />} />
              <Route path="/printers/:id"    element={<PrinterDetail />} />
              <Route path="/projects"        element={<Projects />} />
              <Route path="/jobs"            element={<Jobs />} />
              <Route path="/decommissioned"  element={<Decommissioned />} />
              <Route path="/users"           element={<Users />} />
              <Route path="/settings"        element={<Settings />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
