import { useNavigate, useLocation } from 'react-router-dom';
import { useTopBar } from '../contexts/TopBarContext';
import { IconMenu, IconBack } from './Icons';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { title } = useTopBar();
  const navigate = useNavigate();
  const location = useLocation();

  const isContainerView = /^\/containers\/[^/]+$/.test(location.pathname);
  const isPositionView = /^\/containers\/[^/]+\/positions\/[^/]+$/.test(location.pathname);
  const isAiSearch = location.pathname === '/ai-search';
  const isSettings = location.pathname === '/settings';

  const handleBack = () => {
    if (isPositionView) {
      const match = location.pathname.match(/^(\/containers\/[^/]+)/);
      if (match) navigate(match[1]);
    } else if (isContainerView || isAiSearch || isSettings) {
      navigate('/containers');
    }
  };

  const showBack = isContainerView || isPositionView || isAiSearch || isSettings;
  // Don't show back on main containers list - that's the home
  const showBackBtn = showBack && !(location.pathname === '/containers');

  return (
    <header style={styles.bar}>
      <button style={styles.menuBtn} onClick={onMenuClick} aria-label="Valikko">
        <IconMenu />
      </button>
      {showBackBtn && (
        <button style={styles.backBtn} onClick={handleBack} aria-label="Takaisin">
          <IconBack />
        </button>
      )}
      <h1 style={styles.title}>{title}</h1>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    height: 52,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-surface-hover)',
    flexShrink: 0,
  },
  menuBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    color: 'var(--color-text)',
    flexShrink: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 600,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
};
