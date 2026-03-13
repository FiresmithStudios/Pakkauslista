import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useDisplayName } from '../hooks/useDisplayName';
import { exportDataAsync } from '../api';
import { TopBarProvider } from '../contexts/TopBarContext';
import TopBar from './TopBar';
import { IconSettings, IconSearch, IconDownload, IconBox, IconClose } from './Icons';

export default function AppLayout() {
  const { user } = useAuth();
  const displayName = useDisplayName();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    { path: '/containers', label: 'Kontit', icon: IconBox },
    { path: '/ai-search', label: 'AI-haku', icon: IconSearch },
    { path: '/settings', label: 'Asetukset', icon: IconSettings },
  ];

  const handleExport = async () => {
    try {
      const json = await exportDataAsync();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warehouse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      closeSidebar();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <TopBarProvider>
      <div style={styles.wrapper}>
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        {sidebarOpen && (
          <>
            <div
              style={styles.overlay}
              onClick={closeSidebar}
              aria-hidden
            />
            <aside style={styles.sidebar}>
              <div style={styles.sidebarHeader}>
                <span style={styles.sidebarTitle}>Valikko</span>
                <button style={styles.closeBtn} onClick={closeSidebar} aria-label="Sulje">
                  <IconClose />
                </button>
              </div>
              <p style={styles.userInfo}>
                {displayName || user?.name}
              </p>
              <nav style={styles.nav}>
                {navItems.map(({ path, label, icon: Icon }) => (
                  <button
                    key={path}
                    style={{
                      ...styles.navItem,
                      ...(location.pathname.startsWith(path) ? styles.navItemActive : {}),
                    }}
                    onClick={() => {
                      navigate(path);
                      closeSidebar();
                    }}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
                <button style={styles.navItem} onClick={handleExport}>
                  <IconDownload />
                  <span>Lataa varmuuskopio</span>
                </button>
              </nav>
            </aside>
          </>
        )}

        <main style={styles.main}>
          <Outlet />
        </main>
      </div>
    </TopBarProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.46)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    zIndex: 1000,
    animation: 'fadeInSoft 220ms var(--ease-smooth)',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    maxWidth: '85vw',
    background: 'var(--color-glass)',
    backdropFilter: 'blur(10px) saturate(120%)',
    WebkitBackdropFilter: 'blur(10px) saturate(120%)',
    boxShadow: '8px 0 24px rgba(0,0,0,0.3)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInLeftSoft 220ms var(--ease-smooth)',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 16px',
    borderBottom: '1px solid var(--color-surface-hover)',
  },
  sidebarTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  closeBtn: {
    padding: 8,
    background: 'none',
    color: 'var(--color-text-muted)',
  },
  userInfo: {
    padding: '16px 20px',
    margin: 0,
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
  },
  nav: {
    flex: 1,
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    background: 'transparent',
    color: 'var(--color-text)',
    fontSize: '1rem',
    textAlign: 'left',
    borderRadius: 10,
    margin: '0 10px',
  },
  navItemActive: {
    background: 'var(--color-surface-hover)',
    color: 'var(--color-accent)',
    boxShadow: '0 6px 16px rgba(2, 6, 23, 0.14)',
  },
  main: {
    flex: 1,
    padding: '16px',
    paddingBottom: 28,
    minHeight: 0,
  },
};
