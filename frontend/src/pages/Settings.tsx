import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Shield, Info, HardDrive } from 'lucide-react';


interface SettingsProps {
  user: any;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const Settings: React.FC<SettingsProps> = ({ user, showToast }) => {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(
    (localStorage.getItem('aethervault_theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    if (themeMode === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('aethervault_theme', themeMode);
  }, [themeMode]);

  const handleToggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 style={{ margin: 0 }}>System Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Configure visual settings and monitor your private security credentials.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
        {/* Appearance Settings */}
        <div className="card glass">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {themeMode === 'dark' ? <Moon size={20} /> : <Sun size={20} />} Appearance Theme
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Choose between dark mode or light mode appearance.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${themeMode === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleToggleTheme}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Moon size={16} /> Dark Theme
            </button>
            <button 
              className={`btn ${themeMode === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={handleToggleTheme}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <Sun size={16} /> Light Theme
            </button>
          </div>
        </div>

        {/* User Account Info */}
        <div className="card glass">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Shield size={20} style={{ color: 'var(--success)' }} /> Isolated User Profile
          </h3>
          
          {user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9375rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Username</span>
                <span style={{ fontWeight: '600' }}>{user.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9375rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email Address</span>
                <span style={{ fontWeight: '600' }}>{user.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.9375rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Account Role</span>
                <span style={{ fontWeight: '600', textTransform: 'capitalize', color: 'var(--primary)' }}>{user.role || 'user'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quota Limits summary */}
        <div className="card glass">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <HardDrive size={20} /> Disk Quota Sandbox Rules
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            All operations are bound by isolated local path validations. Arbitrary system file paths are locked.
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)'
          }}>
            <Info size={20} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
              Default server storage allocation is set to <strong>10 GB</strong> per user. Renaming, moving, and copying operations occur within SQLite virtual indexes.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
