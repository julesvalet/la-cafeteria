import { Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from '../features/account/components/AccountMenu';

export function Header() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="site-brand">
          <img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="La Cafétéria" className="site-logo" />
          <span>La Cafétéria</span>
        </Link>
        <div className="site-header-actions">
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
