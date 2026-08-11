import { useTheme } from '../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Activer le thème sombre' : 'Activer le thème clair'}
      title={theme === 'light' ? 'Thème sombre' : 'Thème clair'}
    >
      <span className={`theme-toggle-icon ${theme === 'dark' ? 'is-dark' : ''}`} aria-hidden="true">
        {theme === 'light' ? '☀️' : '🌙'}
      </span>
    </button>
  );
}
