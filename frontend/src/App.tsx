import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  Shield, HardDrive, Files, FileText, AlertTriangle, Settings as SettingsIcon, LogOut, Sun, Moon, Sparkles, Trash2
} from 'lucide-react';
import { api } from './utils/api';

// Pages
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { FileBrowser } from './pages/FileBrowser';
import { VaultNotes } from './pages/VaultNotes';
import { AIOrganize } from './pages/AIOrganize';
import { Duplicates } from './pages/Duplicates';
import { RecycleBin } from './pages/RecycleBin';
import { Settings } from './pages/Settings';

// Components
import { Toast } from './components/Toast';

// Layout Wrapper
const AppLayout: React.FC<{ 
  user: any; 
  onLogout: () => void; 
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  children: React.ReactNode 
}> = ({ user, onLogout, showToast, children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    (localStorage.getItem('aethervault_theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('aethervault_theme', next);
    showToast(`Switched to ${next === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
  };

  const getPageTitle = (pathname: string) => {
    if (pathname.includes('/dashboard')) return 'Dashboard';
    if (pathname.includes('/files')) return 'My Files';
    if (pathname.includes('/notes')) return 'Secure Vault Notes';
    if (pathname.includes('/organize')) return 'AI Organizer';
    if (pathname.includes('/duplicates')) return 'Duplicates Scanner';
    if (pathname.includes('/trash')) return 'Recycle Bin';
    if (pathname.includes('/settings')) return 'System Settings';
    return 'AetherVault';
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <HardDrive size={18} /> },
    { path: '/files', label: 'My Files', icon: <Files size={18} /> },
    { path: '/notes', label: 'Secure Notes', icon: <FileText size={18} /> },
    { path: '/organize', label: 'AI Organizer', icon: <Sparkles size={18} /> },
    { path: '/duplicates', label: 'Duplicates Scanner', icon: <AlertTriangle size={18} /> },
    { path: '/trash', label: 'Recycle Bin', icon: <Trash2 size={18} /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Shield size={26} style={{ color: 'var(--primary)' }} />
          <span>AetherVault</span>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="sidebar-menu">
            {menuItems.map(item => (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Card & Log Out */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {user && (
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontWeight: '600', fontSize: '0.875rem', display: 'block', color: 'var(--text-main)' }}>{user.username}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user.email}</span>
            </div>
          )}
          <button 
            className="sidebar-item" 
            onClick={onLogout}
            style={{ 
              background: 'none', border: 'none', width: '100%', textAlign: 'left',
              color: 'var(--error)', cursor: 'pointer', padding: '0.5rem 1rem'
            }}
          >
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              style={{ display: 'none', padding: '0.5rem' }} // Will override in media query if needed
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Files size={18} />
            </button>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{getPageTitle(location.pathname)}</h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Theme Toggle Button */}
            <button 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '50%' }}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                padding: '0.375rem 0.875rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                <span>Local server active</span>
              </div>
            )}
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('aethervault_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    showToast('Logged out successfully', 'info');
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Login onSuccess={handleLoginSuccess} showToast={showToast} />
          } 
        />
        <Route 
          path="/register" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <Register showToast={showToast} />
          } 
        />

        {/* Private App layouts */}
        <Route 
          path="/dashboard" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <Dashboard />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/files" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <FileBrowser showToast={showToast} />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/notes" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <VaultNotes />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route path="/chat" element={<Navigate to="/notes" replace />} />
        <Route 
          path="/organize" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <AIOrganize showToast={showToast} />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/duplicates" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <Duplicates showToast={showToast} />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/trash" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <RecycleBin showToast={showToast} />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/settings" 
          element={
            user ? (
              <AppLayout user={user} onLogout={handleLogout} showToast={showToast}>
                <Settings user={user} showToast={showToast} />
              </AppLayout>
            ) : <Navigate to="/login" replace />
          } 
        />

        {/* Catchall redirects */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Floating Alerts notifications */}
      {toast && (
        <div className="toast-container">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </BrowserRouter>
  );
}
