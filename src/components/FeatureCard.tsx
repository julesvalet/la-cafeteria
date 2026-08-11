import { Link } from 'react-router-dom';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  to?: string;
  comingSoon?: boolean;
}

export function FeatureCard({ title, description, icon, to, comingSoon }: FeatureCardProps) {
  const content = (
    <>
      <span className="feature-card-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {comingSoon && <span className="feature-card-badge">Bientôt disponible</span>}
    </>
  );

  if (comingSoon || !to) {
    return (
      <div className="feature-card feature-card-disabled" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className="feature-card">
      {content}
    </Link>
  );
}
